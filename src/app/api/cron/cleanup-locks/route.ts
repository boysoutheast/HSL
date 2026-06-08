import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function run() {
  const now = new Date()

  const unlockedLocks = await prisma.postingMonitor.updateMany({
    where: {
      status: 'HOT_VIDEO',
      lockedUntil: { lt: now },
    },
    data: {
      status: 'NEED_NEW_VIDEO',
      lockedUntil: null,
    },
  })

  const deletedExpiredSessions = await prisma.session.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  })

  return {
    updated: unlockedLocks.count,
    deletedExpiredSessions: deletedExpiredSessions.count,
    ts: now.toISOString(),
  }
}

function checkAuth(req: NextRequest): boolean {
  const CRON_SECRET = process.env.CRON_SECRET
  if (!CRON_SECRET) return true

  const xSecret = req.headers.get('x-cron-secret')
  const bearer = req.headers.get('authorization')
  return xSecret === CRON_SECRET || bearer === `Bearer ${CRON_SECRET}`
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    console.warn('[cleanup-locks] Unauthorized attempt')
    return NextResponse.json({ ok: false, error: 'Unauthorized', ts: new Date().toISOString() })
  }
  try {
    const { updated, ts } = await run()
    return NextResponse.json({ ok: true, updated, ts })
  } catch (err) {
    console.error('[cleanup-locks] Error:', err)
    return NextResponse.json({ ok: false, error: String(err), ts: new Date().toISOString() })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
