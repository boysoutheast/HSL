import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { deriveMetrics } from '@/lib/test-metrics'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const test = await prisma.adTest.findUnique({
    where: { id: params.id },
    include: { variants: true },
  })

  if (!test) {
    return NextResponse.json({ error: 'AdTest not found' }, { status: 404 })
  }
  if (auth.role !== 'admin' && test.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const syncedVariants = []

  for (const variant of test.variants) {
    if (!variant.metaAdId) {
      syncedVariants.push({ id: variant.id, label: variant.label, synced: false, reason: 'no metaAdId' })
      continue
    }

    // Get latest MetricSnapshot for this meta ad
    const snapshot = await prisma.metricSnapshot.findFirst({
      where: { metaEntityId: variant.metaAdId },
      orderBy: { windowEnd: 'desc' },
    })

    if (!snapshot) {
      syncedVariants.push({ id: variant.id, label: variant.label, synced: false, reason: 'no snapshot found' })
      continue
    }

    const counters = {
      spend: snapshot.spend ?? 0,
      impressions: snapshot.impressions ?? 0,
      clicks: snapshot.clicks ?? 0,
      linkClicks: snapshot.linkClicks ?? 0,
      leads: snapshot.leads ?? 0,
      purchases: snapshot.purchases ?? 0,
      revenue: snapshot.purchaseValue ?? 0,
      landingPageViews: 0, // MetricSnapshot may not have this field yet
    }

    const derived = deriveMetrics(counters)

    await prisma.adTestVariant.update({
      where: { id: variant.id },
      data: {
        spend: counters.spend,
        impressions: counters.impressions,
        clicks: counters.clicks,
        linkClicks: counters.linkClicks,
        leads: counters.leads,
        purchases: counters.purchases,
        revenue: counters.revenue,
        ...derived,
        lastSyncedAt: new Date(),
      },
    })

    syncedVariants.push({
      id: variant.id,
      label: variant.label,
      name: variant.name,
      synced: true,
      counters,
      derived,
    })
  }

  return NextResponse.json({ syncedVariants })
}
