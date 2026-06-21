/**
 * Unit test: rule-engine.ts
 * Tests: AND/OR/NOT nested + every operator + edge null metric
 * Run: npx tsx src/lib/rule-engine.test.ts
 */

import {
  evaluateRule,
  resolveAction,
  parseConditionTree,
  Condition,
  MetricsMap,
} from './rule-engine'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.error(`  ❌ ${label}`)
    failed++
  }
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), label)
}

// ── Metrics fixture ───────────────────────────────────────
const metrics: MetricsMap = {
  spend: 50000,
  roas: 2.5,
  cpc: 1500,
  ctr: 2.1,
  purchases: 10,
  impressions: 5000,
  frequency: 2.1,
  cpa: 5000,
}

console.log('\n=== rule-engine.ts — Unit Tests ===\n')

// ── 1. Single leaf: gt ────────────────────────────────────
console.log('── Leaf: gt ──')
assert(evaluateRule({ metric: 'spend', operator: 'gt', value: 10000 }, metrics).matched, 'spend > 10000')
assert(!evaluateRule({ metric: 'spend', operator: 'gt', value: 100000 }, metrics).matched, 'spend > 100000 (false)')

// ── 2. Single leaf: gte ───────────────────────────────────
console.log('\n── Leaf: gte ──')
assert(evaluateRule({ metric: 'roas', operator: 'gte', value: 2.5 }, metrics).matched, 'roas >= 2.5')
assert(!evaluateRule({ metric: 'roas', operator: 'gte', value: 3.0 }, metrics).matched, 'roas >= 3.0 (false)')

// ── 3. Single leaf: lt ────────────────────────────────────
console.log('\n── Leaf: lt ──')
assert(evaluateRule({ metric: 'cpc', operator: 'lt', value: 2000 }, metrics).matched, 'cpc < 2000')
assert(!evaluateRule({ metric: 'cpc', operator: 'lt', value: 1000 }, metrics).matched, 'cpc < 1000 (false)')

// ── 4. Single leaf: eq ────────────────────────────────────
console.log('\n── Leaf: eq ──')
assert(evaluateRule({ metric: 'purchases', operator: 'eq', value: 10 }, metrics).matched, 'purchases == 10')
assert(!evaluateRule({ metric: 'purchases', operator: 'eq', value: 5 }, metrics).matched, 'purchases == 5 (false)')

// ── 5. Single leaf: ne ────────────────────────────────────
console.log('\n── Leaf: ne ──')
assert(evaluateRule({ metric: 'purchases', operator: 'ne', value: 5 }, metrics).matched, 'purchases != 5')
assert(!evaluateRule({ metric: 'purchases', operator: 'ne', value: 10 }, metrics).matched, 'purchases != 10 (false)')

// ── 6. AND ────────────────────────────────────────────────
console.log('\n── AND ──')
const andMatch: Condition = {
  op: 'AND',
  children: [
    { metric: 'spend', operator: 'gt', value: 10000 },
    { metric: 'roas', operator: 'gte', value: 2.0 },
  ],
}
assert(evaluateRule(andMatch, metrics).matched, 'spend>10k AND roas>=2.0 (both true)')

const andNoMatch: Condition = {
  op: 'AND',
  children: [
    { metric: 'spend', operator: 'gt', value: 100000 },
    { metric: 'roas', operator: 'gte', value: 2.0 },
  ],
}
assert(!evaluateRule(andNoMatch, metrics).matched, 'spend>100k AND roas>=2.0 (one false)')

// ── 7. OR ─────────────────────────────────────────────────
console.log('\n── OR ──')
const orMatch: Condition = {
  op: 'OR',
  children: [
    { metric: 'spend', operator: 'gt', value: 100000 },
    { metric: 'roas', operator: 'gte', value: 2.0 },
  ],
}
assert(evaluateRule(orMatch, metrics).matched, 'spend>100k OR roas>=2.0 (one true)')

const orNoMatch: Condition = {
  op: 'OR',
  children: [
    { metric: 'spend', operator: 'gt', value: 100000 },
    { metric: 'roas', operator: 'gte', value: 5.0 },
  ],
}
assert(!evaluateRule(orNoMatch, metrics).matched, 'spend>100k OR roas>=5.0 (both false)')

// ── 8. NOT ────────────────────────────────────────────────
console.log('\n── NOT ──')
const notMatch: Condition = {
  op: 'NOT',
  children: [
    { metric: 'spend', operator: 'gt', value: 100000 },
  ],
}
assert(evaluateRule(notMatch, metrics).matched, 'NOT(spend>100k) = true')

const notNoMatch: Condition = {
  op: 'NOT',
  children: [
    { metric: 'spend', operator: 'gt', value: 10000 },
  ],
}
assert(!evaluateRule(notNoMatch, metrics).matched, 'NOT(spend>10k) = false')

// ── 9. Nested AND + OR + NOT ──────────────────────────────
console.log('\n── Nested: (A AND B) OR NOT(C) ──')
const nested: Condition = {
  op: 'OR',
  children: [
    {
      op: 'AND',
      children: [
        { metric: 'spend', operator: 'gt', value: 10000 },
        { metric: 'roas', operator: 'gte', value: 2.0 },
      ],
    },
    {
      op: 'NOT',
      children: [{ metric: 'cpc', operator: 'lt', value: 500 }],
    },
  ],
}
assert(evaluateRule(nested, metrics).matched, '(spend>10k AND roas>=2) OR NOT(cpc<500) = true')

// ── 10. Edge: roas null ───────────────────────────────────
console.log('\n── Edge: null metric ──')
const nullMetrics: MetricsMap = {
  spend: 10000, roas: null, cpc: null, ctr: null, purchases: 0, impressions: 1000, frequency: null, cpa: null,
}
// roas gt anything with null → false
assert(!evaluateRule({ metric: 'roas', operator: 'gt', value: 0 }, nullMetrics).matched, 'roas > 0 with null → false')
// spend still works
assert(evaluateRule({ metric: 'spend', operator: 'gt', value: 5000 }, nullMetrics).matched, 'spend > 5000 with null roas')

// ── 11. Results JSON ──────────────────────────────────────
console.log('\n── Result JSON ──')
const result = evaluateRule({ metric: 'spend', operator: 'gt', value: 10000 }, metrics)
assert(typeof result.matched === 'boolean', 'result.matched is boolean')
const keys = Object.keys(result.results)
assert(keys.length === 1, 'result has 1 leaf entry')
assert(result.results[keys[0]].actual === 50000, 'result includes actual value')

// ── 12. resolveAction ─────────────────────────────────────
console.log('\n── resolveAction ──')
const incPct = resolveAction({ actionType: 'UPDATE_BUDGET', mode: 'increase_pct', amount: 20 }, 50000)
assertEq(incPct.payload.dailyBudget, 60000, 'increase_pct 20% of 50000 = 60000')

const decPct = resolveAction({ actionType: 'UPDATE_BUDGET', mode: 'decrease_pct', amount: 10 }, 50000)
assertEq(decPct.payload.dailyBudget, 45000, 'decrease_pct 10% of 50000 = 45000')

const setAbs = resolveAction({ actionType: 'UPDATE_BUDGET', mode: 'set_absolute', amount: 75000 })
assertEq(setAbs.payload.dailyBudget, 75000, 'set_absolute 75000')

const pause = resolveAction({ actionType: 'PAUSE' })
assertEq(pause.payload.status, 'PAUSED', 'PAUSE action')

const resume = resolveAction({ actionType: 'RESUME' })
assertEq(resume.payload.status, 'ACTIVE', 'RESUME action')

// ── 13. parseConditionTree ────────────────────────────────
console.log('\n── parseConditionTree ──')
const tree = parseConditionTree('{"op":"AND","children":[{"metric":"spend","operator":"gt","value":10000}]}')
assert(tree !== null, 'parsed JSON')
assert((tree as Condition & { op: string }).op === 'AND', 'root op = AND')

// ── Summary ───────────────────────────────────────────────
console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
