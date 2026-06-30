/**
 * rule-engine.ts — Condition tree evaluator + action resolver
 *
 * Tree: { op: 'AND'|'OR'|'NOT', children: [...] } | { metric, operator, value }
 *   operator: gt|gte|lt|lte|eq|ne
 *   metric: spend|roas|cpc|ctr|purchases|impressions
 */

export type Operator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne'
export type Metric = 'spend' | 'roas' | 'cpc' | 'ctr' | 'purchases' | 'impressions' | 'frequency' | 'cpa'
  | 'roas_min_7d' | 'frequency_max_7d' | 'cpa_change_pct_3d' | 'adset_age_days' | 'days_with_data'

export interface LeafCondition {
  metric: Metric
  operator: Operator
  value: number
}

export interface CompositeCondition {
  op: 'AND' | 'OR' | 'NOT'
  children: Condition[]
}

export type Condition = LeafCondition | CompositeCondition | TestOutcomeCondition

export interface TestOutcomeCondition {
  type: 'TEST_OUTCOME'
  adTestId: string
  expect: 'WINNER_DECLARED'
}

export interface MetricsMap {
  spend: number
  roas: number | null
  cpc: number | null
  ctr: number | null
  purchases: number
  impressions: number
  frequency: number | null
  cpa: number | null
  // Fase 4 — Temporal (turunan dari snapshot harian, bisa null jika <3 hari data)
  roas_min_7d?: number | null
  frequency_max_7d?: number | null
  cpa_change_pct_3d?: number | null
  adset_age_days?: number | null
  days_with_data?: number | null
}

export interface EvaluationResult {
  matched: boolean
  results: Record<string, { metric: Metric; operator: Operator; threshold: number; actual: number | null; matched: boolean }>
}

// ── Operator evaluator ────────────────────────────────────

function evalOperator(operator: Operator, actual: number, threshold: number): boolean {
  switch (operator) {
    case 'gt':  return actual > threshold
    case 'gte': return actual >= threshold
    case 'lt':  return actual < threshold
    case 'lte': return actual <= threshold
    case 'eq':  return actual === threshold
    case 'ne':  return actual !== threshold
    default:    return false
  }
}

// ── Key generator for result tracking ─────────────────────

let resultCounter = 0
function nextKey(): string { return `eval_${++resultCounter}` }

// ── Core evaluator ────────────────────────────────────────

export function evaluateRule(
  condition: Condition,
  metrics: MetricsMap,
  options?: { getAdTestStatus?: (id: string) => string | undefined },
): EvaluationResult {
  resultCounter = 0 // reset per evaluation
  const results: EvaluationResult['results'] = {}

  function evalNode(node: Condition): boolean {
    // TestOutcome condition
    if ('type' in node && node.type === 'TEST_OUTCOME') {
      const toc = node as TestOutcomeCondition
      const status = options?.getAdTestStatus?.(toc.adTestId)
      const matched = status === toc.expect
      const key = nextKey()
      results[key] = {
        metric: 'TEST_OUTCOME' as unknown as Metric,
        operator: 'eq' as Operator,
        threshold: 0,
        actual: 0,
        matched,
      }
      return matched
    }

    if ('op' in node) {
      // Composite
      const childResults = node.children.map(c => evalNode(c))
      if (node.op === 'AND') return childResults.every(r => r)
      if (node.op === 'OR')  return childResults.some(r => r)
      if (node.op === 'NOT') return !childResults[0] // single child
      return false
    }

    // Leaf
    const leaf = node as LeafCondition
    const metricsRecord = metrics as unknown as Record<string, number | null | undefined>
    const raw = metricsRecord[leaf.metric]
    const actual = raw !== undefined ? raw : null // temporal undefined → null (tidak match)
    const matched = actual !== null && evalOperator(leaf.operator, actual, leaf.value)
    const key = nextKey()
    results[key] = {
      metric: leaf.metric,
      operator: leaf.operator,
      threshold: leaf.value,
      actual,
      matched,
    }
    return matched
  }

  const matched = evalNode(condition)
  return { matched, results }
}

// ── Action Resolver ───────────────────────────────────────

export interface ActionSpec {
  actionType: string
  mode?: 'increase_pct' | 'decrease_pct' | 'set_absolute' | 'increase_amount' | 'decrease_amount'
  amount?: number
  [key: string]: unknown
}

export interface ResolvedAction {
  actionType: string
  payload: Record<string, unknown>
  [key: string]: unknown
}

export function resolveAction(
  spec: ActionSpec,
  currentBudget?: number,
): ResolvedAction {
  const payload: Record<string, unknown> = {}

  switch (spec.mode) {
    case 'increase_pct':
      if (currentBudget === undefined) throw new Error('currentBudget required for increase_pct')
      payload.dailyBudget = Math.round(currentBudget * (1 + (spec.amount ?? 10) / 100))
      break
    case 'decrease_pct':
      if (currentBudget === undefined) throw new Error('currentBudget required for decrease_pct')
      payload.dailyBudget = Math.round(currentBudget * (1 - (spec.amount ?? 10) / 100))
      break
    case 'set_absolute':
      payload.dailyBudget = spec.amount ?? 0
      break
    case 'increase_amount':
      if (currentBudget === undefined) throw new Error('currentBudget required for increase_amount')
      payload.dailyBudget = currentBudget + (spec.amount ?? 0)
      break
    case 'decrease_amount':
      if (currentBudget === undefined) throw new Error('currentBudget required for decrease_amount')
      payload.dailyBudget = currentBudget - (spec.amount ?? 0)
      break
  }

  if (spec.actionType === 'PAUSE') {
    payload.status = 'PAUSED'
  } else if (spec.actionType === 'RESUME') {
    payload.status = 'ACTIVE'
  }

  return {
    actionType: spec.actionType,
    payload,
  }
}

// ── Helper: parse conditionTreeJson ───────────────────────

export function parseConditionTree(json: string): Condition {
  try {
    const parsed = JSON.parse(json)
    return parsed as Condition
  } catch {
    throw new Error('Invalid condition tree JSON')
  }
}
