import { NextRequest, NextResponse } from 'next/server'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'
import { getBalance, getTransactionHistory } from '@/lib/credits'

export const dynamic = 'force-dynamic'

// GET /api/gen/credits — get credit balance and transaction history
export async function GET(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })

  const agent = await validateHermesApiKey(token)
  if (!agent) return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })
  if (!agent.ownerUserId) return NextResponse.json({ error: 'No billing owner for this agent' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const [balance, history] = await Promise.all([getBalance(agent.ownerUserId), getTransactionHistory(agent.ownerUserId, limit, offset)])

  return NextResponse.json({ balance, ...history })
}
