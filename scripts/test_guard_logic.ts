import { resolveAction } from '@/lib/rule-engine'

function overscaleGuard(currentBudget: number, requestedBudget: number, MAX_PCT = 50): number {
  const pctChange = currentBudget > 0 ? ((requestedBudget - currentBudget) / currentBudget) * 100 : 0
  if (pctChange > MAX_PCT) {
    const cappedBudget = Math.round(currentBudget * (1 + MAX_PCT / 100))
    console.log(`  GUARD: ${pctChange.toFixed(0)}% > ${MAX_PCT}% → capped to ${cappedBudget}`)
    return cappedBudget
  }
  return requestedBudget
}

// Test 1: 20% increase (under limit)
const r1 = overscaleGuard(100000, 120000)
console.log(`Test 1 (+20%): ${r1} (expected: 120000) ${r1 === 120000 ? '✅' : '❌'}`)

// Test 2: 60% increase (over limit → capped)
const r2 = overscaleGuard(100000, 160000)
console.log(`Test 2 (+60%): ${r2} (expected: 150000) ${r2 === 150000 ? '✅' : '❌'}`)

// Test 3: 50% increase (exactly at limit)
const r3 = overscaleGuard(100000, 150000)
console.log(`Test 3 (+50%): ${r3} (expected: 150000) ${r3 === 150000 ? '✅' : '❌'}`)

// Test 4: 200% increase (far over limit)
const r4 = overscaleGuard(50000, 150000)
console.log(`Test 4 (+200%): ${r4} (expected: 75000) ${r4 === 75000 ? '✅' : '❌'}`)

// Test 5: decrease (no guard)
const r5 = overscaleGuard(100000, 80000)
console.log(`Test 5 (-20%): ${r5} (expected: 80000) ${r5 === 80000 ? '✅' : '❌'}`)
