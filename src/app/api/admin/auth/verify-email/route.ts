import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token wajib diisi' }, { status: 400 })
  }

  const tokenHash = hashToken(token)

  const verifToken = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  })

  if (!verifToken) {
    return NextResponse.json({ error: 'Token tidak valid' }, { status: 400 })
  }

  if (verifToken.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Token sudah kedaluwarsa' }, { status: 400 })
  }

  // Mark email as verified + delete token
  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: verifToken.userId },
      data: { emailVerified: true },
    }),
    prisma.emailVerificationToken.delete({
      where: { id: verifToken.id },
    }),
  ])

  // Redirect to login with success message
  return Response.redirect(
    new URL('/login?verified=1', req.url),
    302,
  )
}
