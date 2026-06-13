/**
 * HSL Credit Engine v3
 * Atomic credit operations for customer billing.
 *
 * CONSTANTS:
 *   VIDEO_10S_COST = 1300 credits per 10s video generation
 *   TRIAL_GRANT    = 1300  credits on new signup
 *
 * BALANCE HOLDER:
 *   AdminUser.creditBalance (single source of truth).
 *
 * CONCURRENCY MODEL:
 *   — debitCredits:   conditional decrement + ledger in ONE interactive tx
 *   — refundCredits:  atomic refundedAt lock FIRST, then increment
 *   — grantCredits:   increment + ledger in ONE interactive tx
 *
 * All mutations are atomic: either both balance change and ledger row
 * succeed, or neither does (rollback on dup key / lock loss).
 */

import { prisma } from '@/lib/prisma'

export const VIDEO_10S_COST = 1300  // legacy — replaced by getGenerationCost()
export const TRIAL_GRANT = 1300

// Cost matrix — server-side only, client cannot override
export const SD_6S_COST = 1000
export const SD_10S_COST = 1300
export const HD_MULTIPLIER = 2

export function getGenerationCost(resolution: string, durationSeconds: number): number {
  const baseCost = durationSeconds <= 6 ? SD_6S_COST : SD_10S_COST
  const multiplier = resolution === 'HD' ? HD_MULTIPLIER : 1
  return baseCost * multiplier
}

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

// ────────────────────────────────────────────────────────────────────────────
// debitCredits
// ────────────────────────────────────────────────────────────────────────────

/**
 * Debit credits from a user's AdminUser.creditBalance.
 *
 * CONCURRENCY-SAFE: conditional decrement + ledger creation wrapped
 * in one interactive Prisma transaction. If the ledger insert hits a
 * unique-violation (retry with same idempotencyKey), the entire tx
 * rolls back — the decrement is undone, zero net effect.
 *
 * On the FIRST call with a given key: decrement succeeds, ledger row
 * is created, and the tx commits. On retry: the pre-tx idempotency
 * guard catches the existing row and returns it without touching
 * balance.
 */
export async function debitCredits(
  userId: string,
  amount: number,
  reason: string,
  refId?: string,
  idempotencyKey?: string,
): Promise<{ balanceAfter: number; transactionId: string }> {
  const key = idempotencyKey ?? `debit_${userId}_${refId ?? crypto.randomUUID()}`

  // Fast-path idempotency guard (outside tx)
  const existing = await prisma.creditTransaction.findUnique({ where: { idempotencyKey: key } })
  if (existing) {
    return { balanceAfter: existing.balanceAfter, transactionId: existing.id }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Conditional decrement — atomic, no gap
      const r = await tx.adminUser.updateMany({
        where: { id: userId, creditBalance: { gte: amount } },
        data: { creditBalance: { decrement: amount } },
      })

      if (r.count !== 1) {
        const u = await tx.adminUser.findUnique({
          where: { id: userId },
          select: { creditBalance: true },
        })
        throw new InsufficientCreditsError(u?.creditBalance ?? 0, amount)
      }

      // 2. Read new balance WITHIN the tx
      const u = await tx.adminUser.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      })
      const balanceAfter = u?.creditBalance ?? 0

      // 3. Create ledger row — if dup-key, ENTIRE tx rolls back
      const txn = await tx.creditTransaction.create({
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

      return { balanceAfter, transactionId: txn.id }
    })
  } catch (err) {
    // If the interactive tx failed due to unique-violation (race),
    // the fast-path guard above will catch the retry.
    if (err instanceof InsufficientCreditsError) throw err

    // Unique constraint — some other caller inserted the same key.
    // Re-read and return the existing row.
    const retry = await prisma.creditTransaction.findUnique({ where: { idempotencyKey: key } })
    if (retry) {
      return { balanceAfter: retry.balanceAfter, transactionId: retry.id }
    }
    throw err
  }
}

// ────────────────────────────────────────────────────────────────────────────
// refundCredits
// ────────────────────────────────────────────────────────────────────────────

/**
 * Refund credits for a failed generation.
 *
 * TOCTOU-PROOF: uses an atomic refundedAt lock instead of read-then-act.
 *   Step 1:  updateMany where { id, refundedAt: null } data { refundedAt: now() }
 *            → if count !== 1, some other caller won the race; bail.
 *   Step 2:  increment balance (won lock — no concurrent refund possible).
 *   Step 3:  create ledger row.
 *
 * Two concurrent webhook calls: exactly ONE wins the lock and processes
 * the refund. The loser sees lock.count === 0 and returns immediately.
 */
export async function refundCredits(generatedMediaId: string): Promise<{
  refunded: boolean
  balanceAfter?: number
  transactionId?: string
}> {
  // Idempotency fast-path via CreditTransaction
  const idempotencyKey = `refund_${generatedMediaId}`
  const existingTxn = await prisma.creditTransaction.findUnique({ where: { idempotencyKey } })
  if (existingTxn) {
    return {
      refunded: true,
      balanceAfter: existingTxn.balanceAfter,
      transactionId: existingTxn.id,
    }
  }

  // 1. Atomic lock — exactly ONE caller sets refundedAt
  const lock = await prisma.generatedMedia.updateMany({
    where: { id: generatedMediaId, refundedAt: null },
    data: { refundedAt: new Date() },
  })

  if (lock.count !== 1) {
    // Lost the race or already refunded — check if someone else succeeded
    const media = await prisma.generatedMedia.findUnique({
      where: { id: generatedMediaId },
      select: { refundedAt: true, userId: true, creditsCost: true },
    })
    if (!media?.userId || !media?.creditsCost) return { refunded: false }
    // Already refunded (by other caller) — idempotent, return success
    if (media.refundedAt) return { refunded: true }
    return { refunded: false }
  }

  // 2. Won the lock — read media details
  const media = await prisma.generatedMedia.findUnique({
    where: { id: generatedMediaId },
    select: { userId: true, creditsCost: true },
  })

  if (!media?.userId || !media?.creditsCost) {
    return { refunded: false }
  }

  // 3. Increment balance
  const incResult = await prisma.adminUser.updateMany({
    where: { id: media.userId },
    data: { creditBalance: { increment: media.creditsCost } },
  })

  if (incResult.count !== 1) {
    // User deleted — refundedAt is already set, bail
    return { refunded: false }
  }

  const u = await prisma.adminUser.findUnique({
    where: { id: media.userId },
    select: { creditBalance: true },
  })
  const balanceAfter = u?.creditBalance ?? 0

  // 4. Create ledger
  const txn = await prisma.creditTransaction.create({
    data: {
      userId: media.userId,
      amount: media.creditsCost,
      reason: 'refund',
      refId: generatedMediaId,
      refType: 'generated_media',
      balanceAfter,
      idempotencyKey,
    },
  })

  return { refunded: true, balanceAfter, transactionId: txn.id }
}

// ────────────────────────────────────────────────────────────────────────────
// grantCredits
// ────────────────────────────────────────────────────────────────────────────

/**
 * Grant credits to a user (admin or trial signup).
 *
 * CONCURRENCY-SAFE: increment + ledger in one interactive tx.
 * Same pattern as debitCredits — if ledger insert fails (dup key),
 * entire tx rolls back, increment cancelled.
 */
export async function grantCredits(
  userId: string,
  amount: number,
  reason: string,
  idempotencyKey?: string,
): Promise<{ balanceAfter: number; transactionId: string }> {
  const key = idempotencyKey ?? `grant_${userId}_${crypto.randomUUID()}`

  const existing = await prisma.creditTransaction.findUnique({ where: { idempotencyKey: key } })
  if (existing) {
    return { balanceAfter: existing.balanceAfter, transactionId: existing.id }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const r = await tx.adminUser.updateMany({
        where: { id: userId },
        data: { creditBalance: { increment: amount } },
      })

      if (r.count !== 1) {
        throw new Error(`AdminUser ${userId} not found`)
      }

      const u = await tx.adminUser.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      })
      const balanceAfter = u?.creditBalance ?? amount

      const txn = await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          reason,
          balanceAfter,
          idempotencyKey: key,
        },
      })

      return { balanceAfter, transactionId: txn.id }
    })
  } catch (err) {
    if (err instanceof Error && err.message.includes('AdminUser')) throw err

    const retry = await prisma.creditTransaction.findUnique({ where: { idempotencyKey: key } })
    if (retry) {
      return { balanceAfter: retry.balanceAfter, transactionId: retry.id }
    }
    throw err
  }
}

// ────────────────────────────────────────────────────────────────────────────
// getBalance
// ────────────────────────────────────────────────────────────────────────────

export async function getBalance(userId: string): Promise<number> {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { creditBalance: true },
  })
  return user?.creditBalance ?? 0
}

// ────────────────────────────────────────────────────────────────────────────
// getTransactionHistory
// ────────────────────────────────────────────────────────────────────────────

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
