import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hashApiKey } from '@/lib/auth'
import { generateApiKey } from '@/lib/api-key-auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/connections/api-keys — list user's keys (no secret)
export async function GET(req: NextRequest) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user

  const keys = await prisma.userApiKey.findMany({
    where: { userId: user.id, status: 'active' },
    select: {
      id: true,
      prefix: true,
      name: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ apiKeys: keys })
}

// POST /api/admin/connections/api-keys — generate new key (shown ONCE)
export async function POST(req: NextRequest) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user

  let body: { name?: string } = {}
  try { body = await req.json() } catch {}

  const { raw, prefix } = generateApiKey()
  const name = (typeof body.name === 'string' && body.name.trim()) || 'Default'

  await prisma.userApiKey.create({
    data: {
      userId: user.id,
      keyHash: hashApiKey(raw),
      prefix,
      name,
    },
  })

  return NextResponse.json({
    apiKey: raw,
    prefix,
    name,
    message: 'Simpan API key ini sekarang — tidak akan ditampilkan lagi.',
  }, { status: 201 })
}
