import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { graphFetch, MetaGraphError, normalizeMetaAdAccountPath } from '@/lib/meta-graph'
import { decode } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// GET /api/admin/meta-tools/adaccount-capabilities?adAccountId=<internal id>
// Cek permission ad account → bid strategy apa saja yang tersedia.
// Tiap akun beda permission, jadi UI refresh opsi saat ad account dipilih.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const adAccountId = searchParams.get('adAccountId')
  if (!adAccountId) {
    return NextResponse.json({ error: 'adAccountId is required' }, { status: 400 })
  }

  // Ownership: ad account harus milik meta account user ini
  const adAccount = await prisma.metaAdAccount.findFirst({
    where: {
      id: adAccountId,
      metaAccount: auth.role === 'admin' ? {} : { userId: auth.id },
    },
    include: {
      metaAccount: { select: { longLivedTokenEncrypted: true } },
    },
  })
  if (!adAccount) return NextResponse.json({ error: 'Ad account not found' }, { status: 404 })
  if (!adAccount.metaAccount.longLivedTokenEncrypted) {
    return NextResponse.json({ error: 'Meta account token missing — reconnect' }, { status: 400 })
  }

  let token: string
  try {
    token = decode(adAccount.metaAccount.longLivedTokenEncrypted)
  } catch {
    return NextResponse.json({ error: 'Token corrupt — reconnect Meta account' }, { status: 500 })
  }

  try {
    const acc = await graphFetch<{
      capabilities?: string[]
      name?: string
      currency?: string
      account_status?: number
    }>(normalizeMetaAdAccountPath(adAccount.adAccountId), token, {
      params: { fields: 'capabilities,name,currency,account_status' },
    })

    const caps = acc.capabilities ?? []
    // Meta tidak selalu expose capability granular untuk semua bid mode.
    // Jadi HIGHEST_VOLUME / COST_CAP / BID_CAP tetap boleh dipilih,
    // tapi ROAS hanya dibuka kalau signal value optimization memang ada.
    const supportsRoas = caps.some((c) => /ROAS|VALUE_OPTIMIZATION|ADS_VALUE/i.test(c))

    const bidStrategies = [
      {
        value: 'HIGHEST_VOLUME',
        label: 'Highest Volume',
        description: 'Meta auto-bid untuk hasil terbanyak dalam budget. Availability final tetap divalidasi Meta saat launch.',
        requiresAmount: false,
        available: true,
      },
      {
        value: 'COST_CAP',
        label: 'Cost Cap',
        description: 'Jaga rata-rata cost per result di bawah angka target. Availability final tetap divalidasi Meta saat launch.',
        requiresAmount: true,
        amountLabel: 'Target cost per result',
        available: true,
      },
      {
        value: 'BID_CAP',
        label: 'Bid Cap',
        description: 'Batasi bid maksimum di tiap auction. Availability final tetap divalidasi Meta saat launch.',
        requiresAmount: true,
        amountLabel: 'Max bid',
        available: true,
      },
      {
        value: 'MIN_ROAS',
        label: 'ROAS Goal',
        description: supportsRoas
          ? 'Target minimum return on ad spend (butuh pixel + purchase value)'
          : 'Tidak tersedia — akun ini belum punya permission value optimization',
        requiresAmount: true,
        amountLabel: 'Min ROAS (mis. 2.0)',
        available: supportsRoas,
      },
    ]

    return NextResponse.json({
      adAccount: {
        id: adAccount.id,
        name: acc.name ?? adAccount.adAccountName,
        currency: acc.currency ?? adAccount.currency,
        status: acc.account_status,
      },
      bidStrategies,
      rawCapabilities: caps,
    })
  } catch (err) {
    const message = err instanceof MetaGraphError ? err.message : 'Gagal cek capabilities'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
