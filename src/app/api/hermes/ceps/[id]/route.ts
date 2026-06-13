import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// DELETE /api/hermes/ceps/[id] — soft-delete a CEP (set status: inactive)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
  }

  const agent = await validateHermesApiKey(token)
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })
  }

  const cep = await prisma.cep.findUnique({
    where: { id: params.id },
    include: {
      topic: {
        select: { character: { select: { instagramAccountId: true } } },
      },
    },
  })
  if (!cep) {
    return NextResponse.json({ error: 'CEP not found' }, { status: 404 })
  }

  // Check 1: agent created this CEP → allowed
  if (cep.createdByHermesId === agent.id) {
    const updated = await prisma.cep.update({
      where: { id: params.id },
      data: { status: 'inactive' },
    })
    return NextResponse.json({ cep: updated, message: 'CEP deactivated' })
  }

  // Check 2: CEP is via topic → character → IG account assigned to agent
  const targetIgId = cep.topic?.character?.instagramAccountId
  if (targetIgId) {
    const assignment = await prisma.assignment.findFirst({
      where: {
        hermesAgentId: agent.id,
        assignableType: 'instagram_account',
        status: 'active',
        assignableId: targetIgId,
      },
      select: { id: true },
    })

    if (assignment) {
      const updated = await prisma.cep.update({
        where: { id: params.id },
        data: { status: 'inactive' },
      })
      return NextResponse.json({ cep: updated, message: 'CEP deactivated' })
    }
  }

  // Not creator + CEP not in assignment scope → forbidden
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
