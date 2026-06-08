import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { safeMetaError } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

async function metaGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`)
  url.searchParams.set('access_token', token)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return fetch(url, { cache: 'no-store' })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const metaAccount = await prisma.metaAccount.findFirst({
    where: { id: params.id, ...(auth.role === 'admin' ? {} : { userId: auth.id }) },
  })
  if (!metaAccount) {
    return NextResponse.json({ error: 'MetaConnection not found' }, { status: 404 })
  }

  if (!metaAccount.longLivedTokenEncrypted && !metaAccount.shortLivedTokenEncrypted) {
    return NextResponse.json({ error: 'No token stored. Connect Meta account first.' }, { status: 400 })
  }

  const token = (metaAccount.longLivedTokenEncrypted ?? metaAccount.shortLivedTokenEncrypted)!

  const now = new Date()
  const results: {
    businesses: Array<{ id: string; name?: string }>
    adAccounts: Array<{ id: string; name?: string; business?: string; type?: string }>
    pages: Array<{ id: string; name?: string; ig?: string | null }>
    errors: string[]
  } = { businesses: [], adAccounts: [], pages: [], errors: [] }

  // ── Fetch Businesses (/me/businesses) ──
  try {
    const bizRes = await metaGet('me/businesses', token, { fields: 'id,name,verification_status', limit: '100' })
    const bizData = await bizRes.json()
    if (bizRes.ok && bizData?.data) {
      for (const biz of bizData.data) {
        await prisma.metaBusiness.upsert({
          where: { metaAccountId_businessId: { metaAccountId: metaAccount.id, businessId: biz.id } },
          update: { businessName: biz.name, verificationStatus: biz.verification_status ?? null, lastSyncedAt: now },
          create: { metaAccountId: metaAccount.id, businessId: biz.id, businessName: biz.name, verificationStatus: biz.verification_status ?? null, isSelected: false, lastSyncedAt: now },
        })
        results.businesses.push({ id: biz.id, name: biz.name })

        // ── Fetch owned ad accounts per BM ──
        const adRes = await metaGet(`${biz.id}/owned_ad_accounts`, token, { fields: 'id,name,account_status,currency,timezone_name', limit: '100' })
        const adData = await adRes.json()
        if (adRes.ok && adData?.data) {
          for (const acct of adData.data) {
            const aaId = acct.id.replace(/^act_/, '')
            await prisma.metaAdAccount.upsert({
              where: { metaAccountId_adAccountId: { metaAccountId: metaAccount.id, adAccountId: aaId } },
              update: { metaBusinessId: undefined, businessId: biz.id, adAccountName: acct.name, accountStatus: acct.account_status ?? 1, currency: acct.currency ?? null, timezoneName: acct.timezone_name ?? null, lastSyncedAt: now },
              create: { metaAccountId: metaAccount.id, metaBusinessId: undefined, businessId: biz.id, adAccountId: aaId, adAccountName: acct.name, accountStatus: acct.account_status ?? 1, currency: acct.currency ?? null, timezoneName: acct.timezone_name ?? null, isDefault: false, lastSyncedAt: now },
            })
            // Ignore first, update metaBusinessId after creating the relation
            await prisma.metaAdAccount.updateMany({
              where: { metaAccountId: metaAccount.id, adAccountId: aaId },
              data: { metaBusinessId: (await prisma.metaBusiness.findFirst({ where: { metaAccountId: metaAccount.id, businessId: biz.id } }))?.id ?? undefined },
            })
            results.adAccounts.push({ id: aaId, name: acct.name, business: biz.id })
          }
        } else {
          results.errors.push(`owned_ad_accounts for ${biz.id}: ${safeMetaError(adData)}`)
        }

        // ── Fetch client ad accounts per BM ──
        const cliRes = await metaGet(`${biz.id}/client_ad_accounts`, token, { fields: 'id,name,account_status,currency,timezone_name', limit: '100' })
        const cliData = await cliRes.json()
        if (cliRes.ok && cliData?.data) {
          for (const acct of cliData.data) {
            const aaId = acct.id.replace(/^act_/, '')
            await prisma.metaAdAccount.upsert({
              where: { metaAccountId_adAccountId: { metaAccountId: metaAccount.id, adAccountId: aaId } },
              update: { businessId: biz.id, adAccountName: acct.name, accountStatus: acct.account_status ?? 1, currency: acct.currency ?? null, timezoneName: acct.timezone_name ?? null, lastSyncedAt: now },
              create: { metaAccountId: metaAccount.id, businessId: biz.id, adAccountId: aaId, adAccountName: acct.name, accountStatus: acct.account_status ?? 1, currency: acct.currency ?? null, timezoneName: acct.timezone_name ?? null, isDefault: false, lastSyncedAt: now },
            })
            await prisma.metaAdAccount.updateMany({
              where: { metaAccountId: metaAccount.id, adAccountId: aaId },
              data: { metaBusinessId: (await prisma.metaBusiness.findFirst({ where: { metaAccountId: metaAccount.id, businessId: biz.id } }))?.id ?? undefined },
            })
            results.adAccounts.push({ id: aaId, name: acct.name, business: biz.id, type: 'client' })
          }
        }
      }
    } else {
      results.errors.push(`businesses: ${safeMetaError(bizData)}`)
    }
  } catch (e) {
    results.errors.push(`businesses exception: ${String(e)}`)
  }

  // ── Fetch Pages (/me/accounts) ──
  try {
    const pageRes = await metaGet('me/accounts', token, { fields: 'id,name,instagram_business_account{id,username,name}', limit: '100' })
    const pageData = await pageRes.json()
    if (pageRes.ok && pageData?.data) {
      for (const pg of pageData.data) {
        const ig = pg.instagram_business_account
        await prisma.metaPage.upsert({
          where: { metaAccountId_pageId: { metaAccountId: metaAccount.id, pageId: pg.id } },
          update: { pageName: pg.name, igBusinessAccountId: ig?.id ?? null, igUsername: ig?.username ?? null, igName: ig?.name ?? null, lastSyncedAt: now },
          create: { metaAccountId: metaAccount.id, pageId: pg.id, pageName: pg.name, igBusinessAccountId: ig?.id ?? null, igUsername: ig?.username ?? null, igName: ig?.name ?? null, isActive: true, lastSyncedAt: now },
        })
        results.pages.push({ id: pg.id, name: pg.name, ig: ig?.username ?? null })
      }
    } else {
      results.errors.push(`pages: ${safeMetaError(pageData)}`)
    }
  } catch (e) {
    results.errors.push(`pages exception: ${String(e)}`)
  }

  // Update last sync timestamp
  await prisma.metaAccount.update({ where: { id: metaAccount.id }, data: { lastSyncAt: now } })

  return NextResponse.json({
    syncedAt: now.toISOString(),
    businesses: results.businesses.length,
    adAccounts: results.adAccounts.length,
    pages: results.pages.length,
    errors: results.errors.length > 0 ? results.errors : undefined,
  })
}
