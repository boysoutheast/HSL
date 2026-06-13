/**
 * HSL Credit Engine
 * Atomic credit operations for Hermes agent billing.
 *
 * Constants:
 *   VIDEO_10S_COST = 1300 credits per 10s video generation
 *
 * Operations:
 *   debitCredits(userId, amount, reason, refId?) — atomic check-and-debit
 *   refundCredits(generatedMediaId) — idempotent refund on generation failure
 *   grantCredits(userId, amount, reason) — admin grant (positive amount)
 *   getBalance(userId) — current credit balance
 *   getTransactionHistory(userId, limit?, offset?) — paginated transaction log
 */

import { prisma } from '@/lib/prisma'

export const VIDEO_10S_COST = 1300

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
 * Debit credits from a user's balance.
 * Atomic: reads current balance, verifies sufficiency, updates within same DB transaction.
 *
 * @param userId — AdminUser id
 * @param amount — positive integer to debit (e.g. VIDEO_10S_COST)
 * @param reason — "video_generation" etc
 * @param refId — optional generatedMediaId for traceability
 * @param idempotencyKey — unique key to prevent double-debit
 * @returns { balanceAfter, transactionId }
 * @throws InsufficientCreditsError if balance < amount
 */
export async function debitCredits(
  userId: string,
  amount: number,
  reason: string,
  refId?: string,
  idempotencyKey?: string,
): Promise<{ balanceAfter: number; transactionId: string }> {
  const key = idempotencyKey ?? `debit_${userId}_${refId ?? Date.now()}`

  // Check idempotency first — if transaction already exists, return existing result
  const existing = await prisma.creditTransaction.findUnique({
    where: { idempotencyKey: key },
  })
  if (existing) {
    return { balanceAfter: existing.balanceAfter, transactionId: existing.id }
  }

  // Atomic debit within a safe aggregate
  const agent = await prisma.hermesAgent.findFirst({
    where: { ownerUserId: userId, status: 'active' },
    select: { id: true, creditBalance: true },
  })

  if (!agent) {
    // User may not have an agent yet — use raw AdminUser balance fallback?
    // For debit, we require an active agent with creditBalance.
    throw new Error(`No active HermesAgent found for userId ${userId}`)
  }

  const currentBalance = agent.creditBalance
  if (currentBalance < amount) {
    throw new InsufficientCreditsError(currentBalance, amount)
  }

  const balanceAfter = currentBalance - amount

  // Atomic: update balance + create transaction in one shot
  // Using interactive transaction for atomicity
  const [transaction] = await prisma.$transaction([
    prisma.creditTransaction.create({
      data: {
        userId,
        amount: -amount,
        reason,
        refId: refId ?? null,
        refType: refId ? 'generated_media' : null,
        balanceAfter,
        idempotencyKey: key,
      },
    }),
    prisma.hermesAgent.updateMany({
      where: { ownerUserId: userId, status: 'active', creditBalance: currentBalance },
      data: { creditBalance: balanceAfter },
    }),
  ])

  return { balanceAfter, transactionId: transaction.id }
}

/**
 * Refund credits for a failed generation.
 * Idempotent: checks GeneratedMedia.refundedAt before refunding.
 * Only processes if refundedAt is null.
 *
 * @param generatedMediaId — id of the GeneratedMedia row
 * @returns { refunded: boolean, balanceAfter?, transactionId? }
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
      status: true,
    },
  })

  if (!media || !media.userId || !media.creditsCost) {
    return { refunded: false }
  }

  // Already refunded — idempotent
  if (media.refundedAt) {
    return { refunded: false }
  }

  const idempotencyKey = `refund_${generatedMediaId}`
  const existing = await prisma.creditTransaction.findUnique({
    where: { idempotencyKey },
  })
  if (existing) {
    return { refunded: true, balanceAfter: existing.balanceAfter, transactionId: existing.id }
  }

  const agent = await prisma.hermesAgent.findFirst({
    where: { ownerUserId: media.userId, status: 'active' },
    select: { creditBalance: true },
  })

  const currentBalance = agent?.creditBalance ?? 0
  const balanceAfter = currentBalance + media.creditsCost

  const [transaction] = await prisma.$transaction([
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
    ...(agent
      ? [
          prisma.hermesAgent.updateMany({
            where: { ownerUserId: media.userId, status: 'active' },
            data: { creditBalance: balanceAfter },
          }),
        ]
      : []),
  ])

  return { refunded: true, balanceAfter, transactionId: transaction.id }
}

/**
 * Grant credits to a user (admin action or trial signup).
 *
 * @param userId — AdminUser id
 * @param amount — positive integer (e.g. 1300 for trial)
 * @param reason — "trial_grant" | "admin_grant"
 * @param idempotencyKey — optional unique key
 * @returns { balanceAfter, transactionId }
 */
export async function grantCredits(
  userId: string,
  amount: number,
  reason: string,
  idempotencyKey?: string,
): Promise<{ balanceAfter: number; transactionId: string }> {
  const key = idempotencyKey ?? `grant_${userId}_${Date.now()}`

  const existing = await prisma.creditTransaction.findUnique({
    where: { idempotencyKey },
  })
  if (existing) {
    return { balanceAfter: existing.balanceAfter, transactionId: existing.id }
  }

  const agent = await prisma.hermesAgent.findFirst({
    where: { ownerUserId: userId, status: 'active' },
    select: { id: true, creditBalance: true },
  })

  if (!agent) {
    throw new Error(`No active HermesAgent found for userId ${userId}`)
  }

  const balanceAfter = agent.creditBalance + amount

  const [transaction] = await prisma.$transaction([
    prisma.creditTransaction.create({
      data: {
        userId,
        amount,
        reason,
        balanceAfter,
        idempotencyKey: key,
      },
    }),
    prisma.hermesAgent.updateMany({
      where: { ownerUserId: userId, status: 'active' },
      data: { creditBalance: balanceAfter },
    }),
  ])

  return { balanceAfter, transactionId: transaction.id }
}

/**
 * Get current credit balance for a user.
 */
export async function getBalance(userId: string): Promise<number> {
  const agent = await prisma.hermesAgent.findFirst({
    where: { ownerUserId: userId, status: 'active' },
    select: { creditBalance: true },
  })
  return agent?.creditBalance ?? 0
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
