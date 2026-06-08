import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/meta-connections/[id]/sync-assets
 *
 * Syncs assets (Business Managers, Ad Accounts, Pages) from Meta API.
 * Currently creates mock placeholder rows — real Meta API calls ready to plug in.
 *
 * Real Meta endpoints to use:
 *   GET /me/businesses?fields=id,name,verification_status  (long-lived token)
 *   GET /{business_id}/owned_ad_accounts?fields=id,name,account_status,currency,timezone_name
 *   GET /{business_id}/client_ad_accounts?fields=id,name,account_status,currency,timezone_name
 *   GET /me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Verify ownership
  const metaAccount = await prisma.metaAccount.findFirst({
    where: {
      id: params.id,
      ...(auth.role === 'admin' ? {} : { userId: auth.id }),
    },
  })

  if (!metaAccount) {
    return NextResponse.json({ error: 'MetaConnection not found' }, { status: 404 })
  }

  // ── Real Meta API sync (placeholder — plug in when token is available) ───
  // const longLivedToken = await decrypt(metaAccount.longLivedTokenEncrypted)
  // const businessUrl = `https://graph.facebook.com/v21.0/me/businesses?fields=id,name,verification_status&access_token=${longLivedToken}`
  // ... fetch businesses, ad accounts, pages from Meta
  // ─────────────────────────────────────────────────────────────────────────

  // ── Mock sync: find or create placeholder assets ───────────────────────
  const now = new Date()

  // Find or create MetaBusiness
  const business = await prisma.metaBusiness.upsert({
    where: {
      metaAccountId_businessId: {
        metaAccountId: metaAccount.id,
        businessId: 'mock_bm_1',
      },
    },
    update: { lastSyncedAt: now },
    create: {
      metaAccountId: metaAccount.id,
      businessId: 'mock_bm_1',
      businessName: 'BM Demo',
      verificationStatus: 'verified',
      isSelected: true,
      lastSyncedAt: now,
    },
  })

  // Find or create MetaAdAccount
  const adAccount = await prisma.metaAdAccount.upsert({
    where: {
      metaAccountId_adAccountId: {
        metaAccountId: metaAccount.id,
        adAccountId: 'act_mock_123',
      },
    },
    update: { lastSyncedAt: now },
    create: {
      metaAccountId: metaAccount.id,
      metaBusinessId: business.id,
      businessId: 'mock_bm_1',
      adAccountId: 'act_mock_123',
      adAccountName: 'Demo Ad Account',
      accountStatus: 1,
      currency: 'IDR',
      timezoneName: 'Asia/Jakarta',
      isDefault: true,
      lastSyncedAt: now,
    },
  })

  // Find or create MetaPage
  const page = await prisma.metaPage.upsert({
    where: {
      metaAccountId_pageId: {
        metaAccountId: metaAccount.id,
        pageId: 'mock_page_1',
      },
    },
    update: { lastSyncedAt: now },
    create: {
      metaAccountId: metaAccount.id,
      pageId: 'mock_page_1',
      pageName: 'Demo Page',
      isActive: true,
      lastSyncedAt: now,
    },
  })

  // Update metaAccount lastSyncAt
  await prisma.metaAccount.update({
    where: { id: metaAccount.id },
    data: { lastSyncAt: now },
  })

  return NextResponse.json({
    businesses: [business],
    adAccounts: [adAccount],
    pages: [page],
  })
}
