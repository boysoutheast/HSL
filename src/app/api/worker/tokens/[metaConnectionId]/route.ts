import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey } from '@/lib/auth'
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

  const agent = await validateHermesApiKey(apiKey)
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { metaConnectionId } = params

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
