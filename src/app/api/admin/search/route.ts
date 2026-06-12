import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const LIMIT = 5

interface SearchResult {
  id: string
  label: string
  type: 'launch' | 'instagram' | 'product' | 'media'
  href: string
  subtitle?: string
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const like = `%${q}%`

  const [launches, igAccounts, products, media] = await Promise.all([
    (await prisma.testLaunch.findMany({
      where: { name: { contains: q, mode: 'insensitive' }, userId: auth.id },
      select: { id: true, name: true, objective: true },
      take: LIMIT,
      orderBy: { updatedAt: 'desc' },
    })).map((l) => ({
      id: l.id,
      label: l.name,
      type: 'launch' as const,
      href: `/ads?tab=launch&detail=${l.id}`,
      subtitle: l.objective?.replace('OUTCOME_', ''),
    })),

    (await prisma.instagramAccount.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { accountName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true, accountName: true },
      take: LIMIT,
    })).map((a) => ({
      id: a.id,
      label: a.accountName || a.username || 'Unknown',
      type: 'instagram' as const,
      href: `/accounts/${a.id}`,
      subtitle: '@' + (a.username || ''),
    })),

    (await prisma.product.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true, description: true },
      take: LIMIT,
    })).map((p) => ({
      id: p.id,
      label: p.name,
      type: 'product' as const,
      href: `/products/${p.id}`,
      subtitle: p.description?.slice(0, 60) || '',
    })),

    (await prisma.mediaAsset.findMany({
      where: {
        userId: auth.id,
        OR: [
          { label: { contains: q, mode: 'insensitive' } },
          { publicUrl: { contains: q, mode: 'insensitive' } },
          { fileUrl: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, label: true, publicUrl: true, fileUrl: true },
      take: LIMIT,
    })).map((m) => ({
      id: m.id,
      label: m.label || m.publicUrl || m.fileUrl || 'Untitled',
      type: 'media' as const,
      href: `/media-library/${m.id}`,
      subtitle: m.publicUrl || m.fileUrl || '',
    })),
  ])

  return NextResponse.json({
    results: [...launches, ...igAccounts, ...products, ...media],
  })
}
