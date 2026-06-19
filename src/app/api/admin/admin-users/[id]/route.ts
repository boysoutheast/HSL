import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/admin-users/[id]
 * Admin-only. Detail 1 user: profil, kredit, pemakaian, akses.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const user = await prisma.adminUser.findUnique({
    where: { id: params.id },
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
          metaAccounts: true,
          apiKeys: true,
        },
      },
    },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Credits summary (aggregate, bukan loop)
  const creditTransactions = await prisma.creditTransaction.groupBy({
    by: ['amount'],
    where: { userId: params.id },
    _sum: { amount: true },
  })
  const creditAgg = await prisma.creditTransaction.aggregate({
    where: { userId: params.id },
    _sum: { amount: true },
  })
  const granted = await prisma.creditTransaction.aggregate({
    where: { userId: params.id, amount: { gt: 0 } },
    _sum: { amount: true },
  })
  const consumed = await prisma.creditTransaction.aggregate({
    where: { userId: params.id, amount: { lt: 0 } },
    _sum: { amount: true },
  })

  // Last 20 transactions (separate query — bounded)
  const transactions = await prisma.creditTransaction.findMany({
    where: { userId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // Usage: video counts
  const videoCounts = await prisma.generatedMedia.groupBy({
    by: ['status'],
    where: { userId: params.id },
    _count: { id: true },
  })
  const totalVids = videoCounts.reduce((a, v) => a + v._count.id, 0)
  const completedVids = videoCounts.find(v => v.status === 'completed')?._count.id ?? 0
  const failedVids = videoCounts.find(v => v.status === 'failed')?._count.id ?? 0

  // Usage: campaign counts
  const campaignCounts = await prisma.campaignSession.groupBy({
    by: ['status'],
    where: { userId: params.id },
    _count: { id: true },
  })
  const runningCamps = campaignCounts.find(c => c.status === 'RUNNING')?._count.id ?? 0
  const totalCamps = campaignCounts.reduce((a, c) => a + c._count.id, 0)

  // Usage: API keys
  const apiKeys = await prisma.userApiKey.findMany({
    where: { userId: params.id },
    select: { id: true, prefix: true, status: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // Usage: spend all-time from metric snapshots
  const spendAgg = await prisma.metricSnapshot.aggregate({
    where: { userId: params.id },
    _sum: { spend: true },
  })

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      creditBalance: user.creditBalance,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
    credits: {
      balance: user.creditBalance,
      granted: granted._sum.amount ?? 0,
      consumed: Math.abs(consumed._sum.amount ?? 0),
      transactions,
    },
    usage: {
      videos: { total: totalVids, completed: completedVids, failed: failedVids },
      campaigns: { total: totalCamps, running: runningCamps },
      apiKeys,
      metaAccounts: user._count.metaAccounts,
      spendAllTime: spendAgg._sum.spend ?? 0,
    },
  })
}

/**
 * PATCH /api/admin/admin-users/[id]
 * Admin-only. Status: active|suspended|pending. Role: user|admin.
 * Self-guard: admin gak bisa suspend/demote diri sendiri → 422.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: { status?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.status && !body.role) {
    return NextResponse.json({ error: 'Body harus berisi status atau role' }, { status: 400 })
  }

  const user = await prisma.adminUser.findUnique({ where: { id: params.id } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Self-guard: admin gak bisa suspend/demote diri sendiri
  if (params.id === auth.id) {
    if (body.status === 'suspended') {
      return NextResponse.json({ error: 'Tidak bisa menonaktifkan akun sendiri' }, { status: 422 })
    }
    if (body.role === 'user') {
      return NextResponse.json({ error: 'Tidak bisa menurunkan role sendiri' }, { status: 422 })
    }
  }

  // Validate status values
  const validStatuses = ['active', 'suspended', 'pending']
  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: `Status harus ${validStatuses.join(', ')}` }, { status: 400 })
  }

  // Validate role values
  const validRoles = ['user', 'admin']
  if (body.role && !validRoles.includes(body.role)) {
    return NextResponse.json({ error: `Role harus ${validRoles.join(', ')}` }, { status: 400 })
  }

  const data: Record<string, string> = {}
  if (body.status) data.status = body.status
  if (body.role) data.role = body.role

  const updated = await prisma.adminUser.update({
    where: { id: params.id },
    data,
    select: { id: true, email: true, name: true, role: true, status: true, creditBalance: true, lastLoginAt: true, createdAt: true },
  })

  console.log(`[audit] Admin ${auth.id} updated user ${params.id}: ${JSON.stringify(data)}`)

  return NextResponse.json({ user: updated })
}
