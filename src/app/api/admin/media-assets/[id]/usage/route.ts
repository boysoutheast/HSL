import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const asset = await prisma.mediaAsset.findUnique({
    where: { id: params.id },
    select: { id: true, publicUrl: true, fileUrl: true, userId: true },
  })

  if (!asset) {
    return NextResponse.json({ error: 'MediaAsset not found' }, { status: 404 })
  }

  if (auth.role !== 'admin' && asset.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Find usage in test_launch_creatives where creativeUrl matches asset URLs
  const urlMatch = [asset.publicUrl, asset.fileUrl].filter(Boolean) as string[]

  const usedInCreatives = urlMatch.length > 0
    ? await prisma.testLaunchCreative.findMany({
        where: { creativeUrl: { in: urlMatch } },
        select: {
          id: true,
          testLaunchId: true,
          creativeUrl: true,
          status: true,
          testLaunch: {
            select: { id: true, name: true, objective: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    : []

  // Group by test launch
  const launchMap = new Map<string, {
    id: string
    name: string
    objective: string
    status: string
    creativeCount: number
    creativeStatuses: string[]
  }>()

  for (const c of usedInCreatives) {
    const existing = launchMap.get(c.testLaunchId)
    if (existing) {
      existing.creativeCount++
      existing.creativeStatuses.push(c.status)
    } else {
      launchMap.set(c.testLaunchId, {
        id: c.testLaunch.id,
        name: c.testLaunch.name,
        objective: c.testLaunch.objective,
        status: c.testLaunch.status,
        creativeCount: 1,
        creativeStatuses: [c.status],
      })
    }
  }

  // Count creative variants on this asset
  const variantCount = await prisma.creativeVariant.count({
    where: { mediaAssetId: params.id, status: { not: 'ARCHIVED' } },
  })

  return NextResponse.json({
    usage: {
      launches: Array.from(launchMap.values()),
      totalLaunchUsage: usedInCreatives.length,
      variantCount,
    },
  })
}
