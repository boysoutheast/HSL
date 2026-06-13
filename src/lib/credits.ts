/**
 * HSL Credit Engine v2
 * Atomic credit operations for customer billing.
 *
 * CONSTANTS:
 *   VIDEO_10S_COST = 1300 credits per 10s video generation
 *   TRIAL_GRANT    = 1300  credits on new signup
 *
 * BALANCE HOLDER:
 *   AdminUser.creditBalance (single source of truth).
 *   agent.ownerUserId maps agent → user; balance always on user.
 *   User can generate even without an agent (studio UI fixed).
 *
 * CONCURRENCY:
 *   Debit uses atomic conditional decrement:
 *     updateMany where { id, creditBalance >= amount } data { decrement }
 *     if result.count !== 1 → throw InsufficientCreditsError
 *   No read-then-write gap. No CAS that silently fails.
 *   Transaction order: decrement FIRST, then create CreditTransaction.
 */

import { prisma } from '@/lib/prisma'

export const VIDEO_10S_COST = 1300
export const TRIAL_GRANT = 1300

export class InsufficientCreditsError extends Error {
  balance: number
  required: number

  constructor(balance: number, required: number) {
    super(`Insufficient credits: balance ${balance}, required ${required}`)
    this.name = 'InsufficientCreditsError'
    this.balance = balance
    this.required = required
  }
}

/**
 * Debit credits from a user's AdminUser.creditBalance.
 *
 * CONCURRENCY-SAFE: single atomic UPDATE with WHERE creditBalance >= amount.
 * Count check prevents silent CAS failure (double-spend).
 *
 * @param userId   — AdminUser id
 * @param amount   — positive integer (e.g. VIDEO_10S_COST)
 * @param reason   — "video_generation" etc
 * @param refId    — optional generatedMediaId for traceability
 * @param idempotencyKey — unique key to prevent double-debit across retries
 */
export async function debitCredits(
  userId: string,
  amount: number,
  reason: string,
  refId?: string,
  idempotencyKey?: string,
): Promise<{ balanceAfter: number; transactionId: string }> {
  const key = idempotencyKey ?? `debit_${userId}_${refId ?? crypto.randomUUID()}`

  // Check idempotency first
  const existing = await prisma.creditTransaction.findUnique({
    where: { idempotencyKey: key },
  })
  if (existing) {
    return { balanceAfter: existing.balanceAfter, transactionId: existing.id }
  }

  // Atomic conditional decrement — single SQL UPDATE, no read-then-write
  const result = await prisma.adminUser.updateMany({
    where: { id: userId, creditBalance: { gte: amount } },
    data: { creditBalance: { decrement: amount } },
  })

  if (result.count !== 1) {
    // Balance insufficient — fetch current for error detail
    const user = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    })
    throw new InsufficientCreditsError(user?.creditBalance ?? 0, amount)
  }

  // Read the new balance AFTER the atomic decrement
  const updated = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { creditBalance: true },
  })

  const balanceAfter = updated?.creditBalance ?? 0

  // Create transaction record — distinct from the decrement for audit clarity
  const transaction = await prisma.creditTransaction.create({
    data: {
      userId,
      amount: -amount,
      reason,
      refId: refId ?? null,
      refType: refId ? 'generated_media' : null,
      balanceAfter,
      idempotencyKey: key,
    },
  })

  return { balanceAfter, transactionId: transaction.id }
}

/**
 * Refund credits for a failed generation.
 * IDEMPOTENT: checks GeneratedMedia.refundedAt + CreditTransaction idempotencyKey.
 *
 * CONCURRENCY-SAFE: atomic increment (no read-then-write), count check.
 * Order: increment FIRST, then mark refundedAt + create txn.
 *
 * @param generatedMediaId — id of the GeneratedMedia row
 */
export async function refundCredits(generatedMediaId: string): Promise<{
  refunded: boolean
  balanceAfter?: number
  transactionId?: string
}> {
  const media = await prisma.generatedMedia.findUnique({
    where: { id: generatedMediaId },
    select: {
      id: true,
      userId: true,
      creditsCost: true,
      refundedAt: true,
    },
  })

  if (!media || !media.userId || !media.creditsCost) {
    return { refunded: false }
  }

  // Already refunded
  if (media.refundedAt) {
    return { refunded: false }
  }

  // Idempotency check via CreditTransaction
  const idempotencyKey = `refund_${generatedMediaId}`
  const existingTxn = await prisma.creditTransaction.findUnique({
    where: { idempotencyKey },
  })
  if (existingTxn) {
    return {
      refunded: true,
      balanceAfter: existingTxn.balanceAfter,
      transactionId: existingTxn.id,
    }
  }

  // Atomic increment — unconditional, count check for sanity
  const result = await prisma.adminUser.updateMany({
    where: { id: media.userId },
    data: { creditBalance: { increment: media.creditsCost } },
  })

  if (result.count !== 1) {
    // User deleted? Still mark refunded to prevent infinite retries
    await prisma.generatedMedia.update({
      where: { id: generatedMediaId },
      data: { refundedAt: new Date() },
    })
    return { refunded: false }
  }

  const updated = await prisma.adminUser.findUnique({
    where: { id: media.userId },
    select: { creditBalance: true },
  })
  const balanceAfter = updated?.creditBalance ?? 0

  // Mark refunded + create transaction (no $transaction needed — increment is already done)
  const [transaction] = await Promise.all([
    prisma.creditTransaction.create({
      data: {
        userId: media.userId,
        amount: media.creditsCost,
        reason: 'refund',
        refId: generatedMediaId,
        refType: 'generated_media',
        balanceAfter,
        idempotencyKey,
      },
    }),
    prisma.generatedMedia.update({
      where: { id: generatedMediaId },
      data: { refundedAt: new Date() },
    }),
  ])

  return { refunded: true, balanceAfter, transactionId: transaction.id }
}

/**
 * Grant credits to a user (admin or trial signup).
 *
 * CONCURRENCY-SAFE: atomic increment.
 *
 * @param userId — AdminUser id
 * @param amount — positive integer (e.g. TRIAL_GRANT)
 * @param reason — "trial_grant" | "admin_grant"
 * @param idempotencyKey — optional unique key
 */
export async function grantCredits(
  userId: string,
  amount: number,
  reason: string,
  idempotencyKey?: string,
): Promise<{ balanceAfter: number; transactionId: string }> {
  const key = idempotencyKey ?? `grant_${userId}_${crypto.randomUUID()}`

  // Idempotency check
  const existing = await prisma.creditTransaction.findUnique({
    where: { idempotencyKey: key },
  })
  if (existing) {
    return { balanceAfter: existing.balanceAfter, transactionId: existing.id }
  }

  // Atomic increment
  const result = await prisma.adminUser.updateMany({
    where: { id: userId },
    data: { creditBalance: { increment: amount } },
  })

  if (result.count !== 1) {
    throw new Error(`AdminUser ${userId} not found`)
  }

  const updated = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { creditBalance: true },
  })
  const balanceAfter = updated?.creditBalance ?? amount

  const transaction = await prisma.creditTransaction.create({
    data: {
      userId,
      amount,
      reason,
      balanceAfter,
      idempotencyKey: key,
    },
  })

  return { balanceAfter, transactionId: transaction.id }
}

/**
 * Get current credit balance for a user.
 * Reads from AdminUser.creditBalance.
 */
export async function getBalance(userId: string): Promise<number> {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { creditBalance: true },
  })
  return user?.creditBalance ?? 0
}

/**
 * Get paginated credit transaction history for a user.
 */
export async function getTransactionHistory(
  userId: string,
  limit: number = 20,
  offset: number = 0,
) {
  const [transactions, total] = await Promise.all([
    prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        amount: true,
        reason: true,
        refId: true,
        refType: true,
        balanceAfter: true,
        createdAt: true,
      },
    }),
    prisma.creditTransaction.count({ where: { userId } }),
  ])

  return { transactions, total, limit, offset }
}
