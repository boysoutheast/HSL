import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Verify ownership of parent MetaAccount
  const metaAccount = await prisma.metaAccount.findFirst({
    where: {
      id: params.id,
      ...(auth.role === 'admin' ? {} : { userId: auth.id }),
    },
    select: { id: true },
  })

  if (!metaAccount) {
    return NextResponse.json({ error: 'MetaConnection not found' }, { status: 404 })
  }

  let body: { adAccountId: string; enabledForAutomation: boolean } | { selections: { id: string; enabled: boolean }[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if ('selections' in body && Array.isArray(body.selections)) {
    // Bulk update
    const ids = body.selections.map(s => s.id)
    const adAccounts = await prisma.metaAdAccount.findMany({
      where: {
        id: { in: ids },
        metaAccountId: params.id,
      },
      select: { id: true },
    })

    const validIds = new Set(adAccounts.map(a => a.id))
    const updates = body.selections
      .filter(s => validIds.has(s.id))
      .map(s => prisma.metaAdAccount.update({
        where: { id: s.id },
        data: { enabledForAutomation: s.enabled },
      }))

    if (updates.length > 0) {
      await prisma.$transaction(updates)
    }

    return NextResponse.json({ success: true })
  }

  // Single update
  const { adAccountId, enabledForAutomation } = body as { adAccountId: string; enabledForAutomation: boolean }

  if (!adAccountId || typeof enabledForAutomation !== 'boolean') {
    return NextResponse.json({ error: 'adAccountId and enabledForAutomation (boolean) are required' }, { status: 400 })
  }

  const adAccount = await prisma.metaAdAccount.findFirst({
    where: {
      id: adAccountId,
      metaAccountId: params.id,
    },
  })

  if (!adAccount) {
    return NextResponse.json({ error: 'AdAccount not found under this MetaConnection' }, { status: 404 })
  }

  await prisma.metaAdAccount.update({
    where: { id: adAccountId },
    data: { enabledForAutomation },
  })

  return NextResponse.json({ success: true })
}
