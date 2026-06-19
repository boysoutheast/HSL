import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20))
  const skip = (page - 1) * limit

  const status = url.searchParams.get('status')
  const role = url.searchParams.get('role')
  const q = url.searchParams.get('q')
  const sort = url.searchParams.get('sort') || 'recent'

  // Build where clause
  const where: Record<string, unknown> = {}
  if (status) where['status'] = status
  if (role) where['role'] = role
  if (q) {
    where['OR'] = [
      { email: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ]
  }

  // Build orderBy
  let orderBy: Record<string, string>
  switch (sort) {
    case 'balance': orderBy = { creditBalance: 'desc' }; break
    case 'recent': default: orderBy = { createdAt: 'desc' }; break
  }

  const [users, total] = await Promise.all([
    prisma.adminUser.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        creditBalance: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: {
            campaignSessions: true,
            generatedMedia: true,
            apiKeys: true,
            metaAccounts: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.adminUser.count({ where }),
  ])

  return NextResponse.json({
    users,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  })
}
