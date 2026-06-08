import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Validate cron secret
  const cronSecret = req.headers.get('x-cron-secret')
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24h ago

  // Find connected accounts that haven't been called in 24h or never called
  const staleAccounts = await prisma.metaAccount.findMany({
    where: {
      status: 'connected',
      OR: [
        { lastMetaCallAt: null },
        { lastMetaCallAt: { lt: cutoff } },
      ],
    },
    select: { id: true, userId: true, lastMetaCallAt: true },
  })

  if (staleAccounts.length === 0) {
    return NextResponse.json({ checked: 0, skipped: 0, message: 'No stale accounts found' })
  }

  let created = 0
  let skipped = 0

  for (const account of staleAccounts) {
    // Check if a pending check_token task already exists for this account
    // We check payloadJson contains this metaAccountId
    const existing = await prisma.workerTask.findFirst({
      where: {
        type: 'check_token',
        status: { in: ['pending', 'processing'] },
        payloadJson: { contains: `"metaAccountId":"${account.id}"` },
      },
    })

    if (existing) {
      skipped++
      continue
    }

    // Create check_token task
    await prisma.workerTask.create({
      data: {
        type: 'check_token',
        payloadJson: JSON.stringify({
          metaAccountId: account.id,
          userId: account.userId,
          lastMetaCallAt: account.lastMetaCallAt?.toISOString() ?? null,
          queuedAt: now.toISOString(),
        }),
        status: 'pending',
        priority: 9, // low priority — health check
        maxAttempts: 2,
      },
    })

    created++
  }

  return NextResponse.json({
    checked: created,
    skipped,
    total: staleAccounts.length,
    ts: now.toISOString(),
  })
}
