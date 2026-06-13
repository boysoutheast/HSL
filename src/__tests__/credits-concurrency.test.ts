/**
 * Concurrency tests for credits.ts v3
 *
 * These tests require a running PostgreSQL with Prisma schema deployed.
 * Run: npx tsx src/__tests__/credits-concurrency.test.ts
 *
 * Tests:
 *   1. Double refund — 2 concurrent webhooks for same media
 *   2. Double debit  — 2 concurrent debits with same idempotencyKey
 *   3. Concurrent debits — 2 debits racing on low balance (one fails)
 *
 * Each test resets state to a known baseline.
 */

import { prisma } from '@/lib/prisma'
import {
  debitCredits,
  refundCredits,
  grantCredits,
  getBalance,
  InsufficientCreditsError,
  VIDEO_10S_COST,
} from '@/lib/credits'

const TEST_USER_ID = 'credits_test_user'
const TEST_MEDIA_ID = 'credits_test_media'

async function setup() {
  // Upsert test user with known balance
  await prisma.adminUser.upsert({
    where: { id: TEST_USER_ID },
    create: {
      id: TEST_USER_ID,
      email: 'credits-test@hsl.internal',
      passwordHash: 'test',
      role: 'user',
      creditBalance: 3000,
    },
    update: { creditBalance: 3000 },
  })

  // Create a test GeneratedMedia row for refund tests
  await prisma.generatedMedia.upsert({
    where: { id: TEST_MEDIA_ID },
    create: {
      id: TEST_MEDIA_ID,
      userId: TEST_USER_ID,
      source: 'test',
      prompt: 'test concurrency',
      status: 'failed',
      creditsCost: 1300,
      refundedAt: null,
      mediaType: 'VIDEO',
    },
    update: { refundedAt: null, creditsCost: 1300, status: 'failed' },
  })

  // Drop any prior test credit transactions
  await prisma.creditTransaction.deleteMany({ where: { userId: TEST_USER_ID } })
}

async function test(name: string, fn: () => Promise<void>) {
  process.stdout.write(`  ${name}... `)
  try {
    await fn()
    console.log('✅')
  } catch (err) {
    console.log(`❌ ${err instanceof Error ? err.message : err}`)
  }
}

// ──────────────────────────────────────────────────────────────────────────
// TEST 1 — Double refund (TOCTOU fix)
// 2 concurrent refunds for same media → balance naik SEKALI
// ──────────────────────────────────────────────────────────────────────────
async function testDoubleRefund() {
  await setup()

  // Reset refund state
  await prisma.generatedMedia.update({
    where: { id: TEST_MEDIA_ID },
    data: { refundedAt: null },
  })
  await prisma.adminUser.update({
    where: { id: TEST_USER_ID },
    data: { creditBalance: 3000 },
  })
  await prisma.creditTransaction.deleteMany({ where: { userId: TEST_USER_ID } })

  const startBalance = await getBalance(TEST_USER_ID)

  // Race 2 refunds
  const [r1, r2] = await Promise.all([
    refundCredits(TEST_MEDIA_ID),
    refundCredits(TEST_MEDIA_ID),
  ])

  const endBalance = await getBalance(TEST_USER_ID)

  // At least one should claim refunded=true
  const refundCount = [r1, r2].filter(r => r.refunded).length

  console.assert(
    refundCount >= 1,
    'Expected at least 1 refund to succeed',
  )

  console.assert(
    endBalance === startBalance + 1300,
    `Balance should increase by exactly 1300. Got start=${startBalance} end=${endBalance}`,
  )

  console.assert(
    endBalance <= startBalance + 1300,
    `Balance should NOT increase more than 1300 (double refund). Got start=${startBalance} end=${endBalance}`,
  )

  // Verify only one refund txn exists
  const refundTxns = await prisma.creditTransaction.count({
    where: { userId: TEST_USER_ID, reason: 'refund' },
  })
  console.assert(refundTxns === 1, `Expected 1 refund txn, got ${refundTxns}`)
}

// ──────────────────────────────────────────────────────────────────────────
// TEST 2 — Double debit with same idempotencyKey
// 2 concurrent debits with same key → decrement SEKALI
// ──────────────────────────────────────────────────────────────────────────
async function testDoubleDebitSameKey() {
  await setup()
  await prisma.adminUser.update({
    where: { id: TEST_USER_ID },
    data: { creditBalance: 3000 },
  })
  await prisma.creditTransaction.deleteMany({ where: { userId: TEST_USER_ID } })

  const startBalance = await getBalance(TEST_USER_ID)
  const KEY = `test_dup_debit_${Date.now()}`

  // Fire 2 concurrent debits with identical idempotencyKey
  const results = await Promise.allSettled([
    debitCredits(TEST_USER_ID, 1300, 'video_generation', TEST_MEDIA_ID, KEY),
    debitCredits(TEST_USER_ID, 1300, 'video_generation', TEST_MEDIA_ID, KEY),
  ])

  const endBalance = await getBalance(TEST_USER_ID)

  // At least one should succeed
  const fulfilled = results.filter(r => r.status === 'fulfilled').length
  console.assert(fulfilled >= 1, `Expected at least 1 debit to succeed, got ${fulfilled}`)

  // Balance should decrease by exactly 1300 (not 2600)
  console.assert(
    endBalance === startBalance - 1300,
    `Balance should decrease by exactly 1300. Got start=${startBalance} end=${endBalance}`,
  )

  // Only one debit txn
  const debitTxns = await prisma.creditTransaction.count({
    where: { userId: TEST_USER_ID, reason: 'video_generation' },
  })
  console.assert(debitTxns === 1, `Expected 1 debit txn, got ${debitTxns}`)
}

// ──────────────────────────────────────────────────────────────────────────
// TEST 3 — Concurrent debits on low balance (insufficient)
// 2 concurrent debits of 1300 each against balance 1300 → 1 wins, 1 fails
// ──────────────────────────────────────────────────────────────────────────
async function testConcurrentDebitLowBalance() {
  await setup()
  await prisma.adminUser.update({
    where: { id: TEST_USER_ID },
    data: { creditBalance: 1300 },
  })
  await prisma.creditTransaction.deleteMany({ where: { userId: TEST_USER_ID } })

  const startBalance = await getBalance(TEST_USER_ID)

  const results = await Promise.allSettled([
    debitCredits(TEST_USER_ID, 1300, 'video_generation', 'media_a', `key_a_${Date.now()}`),
    debitCredits(TEST_USER_ID, 1300, 'video_generation', 'media_b', `key_b_${Date.now()}`),
  ])

  const endBalance = await getBalance(TEST_USER_ID)

  // Exactly one succeeds, one fails (balance 1300 → 2 × 1300 impossible)
  const fulfilled = results.filter(r => r.status === 'fulfilled').length
  const rejected = results.filter(r => r.status === 'rejected').length

  console.assert(fulfilled === 1, `Expected 1 debit to succeed, got ${fulfilled}`)
  console.assert(rejected === 1, `Expected 1 debit to fail, got ${rejected}`)

  // Rejected must be InsufficientCreditsError
  const failed = results.find(r => r.status === 'rejected')
  if (failed && failed.status === 'rejected') {
    console.assert(
      failed.reason instanceof InsufficientCreditsError,
      'Failed debit should be InsufficientCreditsError',
    )
  }

  // Balance must be 0
  console.assert(endBalance === 0, `Expected balance 0, got ${endBalance}`)

  // Only 1 debit txn
  const debitTxns = await prisma.creditTransaction.count({
    where: { userId: TEST_USER_ID, reason: 'video_generation' },
  })
  console.assert(debitTxns === 1, `Expected 1 debit txn, got ${debitTxns}`)
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔬 Credits Concurrency Tests (v3)\n')

  await test('Double refund — balance naik SEKALI', testDoubleRefund)
  await test('Double debit same key — decrement SEKALI', testDoubleDebitSameKey)
  await test('Concurrent debit low balance — 1 win 1 fail', testConcurrentDebitLowBalance)

  console.log('\nDone.\n')

  const finalBalance = await getBalance(TEST_USER_ID)
  const txns = await prisma.creditTransaction.count({ where: { userId: TEST_USER_ID } })

  await prisma.$disconnect()
}

main().catch(console.error)
