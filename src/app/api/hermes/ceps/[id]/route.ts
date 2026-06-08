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

  const cep = await prisma.cep.findUnique({ where: { id: params.id } })
  if (!cep) {
    return NextResponse.json({ error: 'CEP not found' }, { status: 404 })
  }

  // Only the agent that created it can deactivate it
  if (cep.createdByHermesId && cep.createdByHermesId !== agent.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updated = await prisma.cep.update({
    where: { id: params.id },
    data: { status: 'inactive' },
  })

  return NextResponse.json({ cep: updated, message: 'CEP deactivated' })
}
