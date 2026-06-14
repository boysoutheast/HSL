import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { grantCredits } from '@/lib/credits'

export const dynamic = 'force-dynamic'

// POST /api/admin/credits/grant
// Body: { userId: string, amount: number, reason?: string }
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (admin instanceof NextResponse) return admin

  const body = await req.json()
  const { userId, amount, reason } = body

  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'positive amount required' }, { status: 400 })
  }

  const targetId = userId ?? admin.id
  const result = await grantCredits(targetId, amount, reason ?? `Admin grant by ${admin.email}`)
  return NextResponse.json(result)
}
