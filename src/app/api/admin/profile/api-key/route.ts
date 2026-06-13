import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'

// Web Crypto helpers (edge-compatible)
async function generateApiKey(): Promise<string> {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return 'hs_' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('')
}

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/profile/api-key
 *
 * Self-serve: logged-in user generates a HermesAgent API key for themselves.
 * The key is returned ONCE in plaintext. Only a hash is stored.
 * If the user already has an active agent, returns the existing agent info
 * (without re-showing the key).
 * Balance is read from AdminUser.creditBalance (single source of truth).
 */
export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser(req)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Check if user already has an API key
  const existing = await prisma.hermesAgent.findFirst({
    where: { ownerUserId: sessionUser.id, status: 'active' },
    select: {
      id: true,
      name: true,
      createdAt: true,
      ownerUser: { select: { creditBalance: true } },
    },
  })

  if (existing) {
    return NextResponse.json({
      agent: {
        id: existing.id,
        name: existing.name,
        creditBalance: existing.ownerUser?.creditBalance ?? 0,
        createdAt: existing.createdAt,
      },
      message: 'API key already exists. Cannot re-show key for security.',
    })
  }

  // Generate key: hs_ + 32 random bytes hex
  const rawKey = await generateApiKey()
  const apiKeyHash = await sha256(rawKey)

  const user = await prisma.adminUser.findUnique({
    where: { id: sessionUser.id },
    select: { name: true, email: true, creditBalance: true },
  })

  const agent = await prisma.hermesAgent.create({
    data: {
      name: `${user?.name ?? user?.email ?? 'user'}-agent`,
      apiKeyHash,
      ownerUserId: sessionUser.id,
      status: 'active',
      isWorker: false,
    },
  })

  return NextResponse.json(
    {
      agent: {
        id: agent.id,
        name: agent.name,
        creditBalance: user?.creditBalance ?? 0,
        createdAt: agent.createdAt,
      },
      apiKey: rawKey,
      message: 'Save this API key now. It will not be shown again.',
    },
    { status: 201 },
  )
}

/**
 * GET /api/admin/profile/api-key
 * Return current agent info + credit balance from AdminUser.
 */
export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser(req)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const agent = await prisma.hermesAgent.findFirst({
    where: { ownerUserId: sessionUser.id, status: 'active' },
    select: {
      id: true,
      name: true,
      createdAt: true,
      status: true,
      ownerUser: { select: { creditBalance: true } },
    },
  })

  if (!agent) {
    return NextResponse.json({ agent: null })
  }

  return NextResponse.json({
    agent: {
      id: agent.id,
      name: agent.name,
      creditBalance: agent.ownerUser?.creditBalance ?? 0,
      createdAt: agent.createdAt,
      status: agent.status,
    },
  })
}
