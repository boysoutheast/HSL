import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateWorkerApiKey } from '@/lib/auth'
import { decode } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { metaConnectionId: string } }
) {
  // Auth: x-api-key header only
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const agent = await validateWorkerApiKey(apiKey)
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Extract param
  const { metaConnectionId } = params

  // Audit log — log tiap akses (jangan pernah log nilai token)
  console.info(`[worker/tokens] access by agent=${agent.id} (${agent.name}) connection=${metaConnectionId} at ${new Date().toISOString()}`)

  // Optional IP allowlist — hanya aktif kalau WORKER_IP_ALLOWLIST di-set
  const allowlist = process.env.WORKER_IP_ALLOWLIST
  if (allowlist) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
    const allowed = allowlist.split(',').map(s => s.trim()).filter(Boolean)
    if (!allowed.includes(ip)) {
      console.warn(`[worker/tokens] BLOCKED ip=${ip} not in allowlist, connection=${metaConnectionId}`)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // DEFERRED: Tidak ada model assignment MetaAccount→HermesAgent di schema saat ini.
  // Scope-bind hanya bisa ditambah kalau ada relasi assignment tersebut.
  // Butuh keputusan owner untuk bikin model assignment MetaAccount→worker.

  const metaAccount = await prisma.metaAccount.findUnique({
    where: { id: metaConnectionId },
    select: { longLivedTokenEncrypted: true },
  })

  if (!metaAccount || !metaAccount.longLivedTokenEncrypted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const token = decode(metaAccount.longLivedTokenEncrypted)

  return NextResponse.json({ token })
}
