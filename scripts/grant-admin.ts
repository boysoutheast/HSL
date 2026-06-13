import { prisma } from '../src/lib/prisma'

const ADMIN_ID = 'cmpnsfpkb00017vd42rimxd0j'

async function grantCredits(userId: string, amount: number, reason: string, idempotencyKey: string) {
  const existing = await prisma.creditTransaction.findUnique({ where: { idempotencyKey } })
  if (existing) {
    return { balanceAfter: existing.balanceAfter, transactionId: existing.id, skipped: true }
  }

  return prisma.$transaction(async (tx) => {
    const r = await tx.adminUser.updateMany({
      where: { id: userId },
      data: { creditBalance: { increment: amount } },
    })
    if (r.count !== 1) throw new Error(`User ${userId} not found`)

    const u = await tx.adminUser.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    })
    const balanceAfter = u?.creditBalance ?? amount

    const txn = await tx.creditTransaction.create({
      data: { userId, amount, reason, balanceAfter, idempotencyKey },
    })
    return { balanceAfter, transactionId: txn.id, skipped: false }
  })
}

async function getBalance(userId: string) {
  const u = await prisma.adminUser.findUnique({ where: { id: userId }, select: { creditBalance: true } })
  return u?.creditBalance ?? 0
}

async function main() {
  const before = await getBalance(ADMIN_ID)
  console.log('Balance before:', before)

  const result = await grantCredits(ADMIN_ID, 13_000, 'smoke_test_grant', 'smoke_2026-06-13_01')
  console.log('Result:', JSON.stringify(result))

  const after = await getBalance(ADMIN_ID)
  console.log('Balance after:', after)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('FAIL:', err)
  prisma.$disconnect()
  process.exit(1)
})
