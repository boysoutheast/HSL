import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function run() {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  })
  return { deleted: result.count }
}

function checkAuth(req: NextRequest): boolean {
  const CRON_SECRET = process.env.CRON_SECRET
  if (!CRON_SECRET) return false

  const xSecret = req.headers.get('x-cron-secret')
  const bearer = req.headers.get('authorization')
  return xSecret === CRON_SECRET || bearer === `Bearer ${CRON_SECRET}`
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    console.warn('[cleanup-sessions] Unauthorized attempt')
    return NextResponse.json({ ok: false, error: 'Unauthorized', ts: new Date().toISOString() })
  }
  try {
    const { deleted } = await run()
    return NextResponse.json({ ok: true, deleted, ts: new Date().toISOString() })
  } catch (err) {
    console.error('[cleanup-sessions] Error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error', ts: new Date().toISOString() })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
