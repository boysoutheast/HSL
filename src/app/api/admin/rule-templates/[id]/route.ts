import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// DELETE /api/admin/rule-templates/[id] — hapus custom template (builtin tidak bisa)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const template = await prisma.ruleTemplate.findUnique({ where: { id: params.id } })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (template.isBuiltin) {
    return NextResponse.json({ error: 'Built-in templates cannot be deleted' }, { status: 400 })
  }
  if (template.userId !== auth.id && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.ruleTemplate.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
