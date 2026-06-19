/**
 * rule-readable.ts
 * Convert conditionTreeJson + actionSpecJson into human-readable strings.
 * Reusable in list views, builder previews, and campaign detail panels.
 *
 * Condition tree format:
 * {
 *   operator: 'AND' | 'OR',
 *   conditions: [
 *     { metric: 'roas', operator: '>', value: 2, type: 'number' },
 *     { metric: 'spend', operator: '>', value: 50000, type: 'number' }
 *   ]
 * }
 *
 * Action spec format:
 * {
 *   action: 'update_budget' | 'pause_adset' | 'pause_campaign' | 'notify' | 'scale_budget',
 *   params: { percentage?: number, fixedAmount?: number, target?: string }
 * }
 */

interface Condition {
  metric: string
  operator: string
  value: number | string
  type?: string
}

interface ConditionTree {
  operator?: string
  conditions?: Condition[] | ConditionTree[]
}

interface ActionSpec {
  action: string
  params?: Record<string, unknown>
}

const METRIC_LABELS: Record<string, string> = {
  roas: 'ROAS',
  spend: 'Spend',
  leads: 'Leads',
  purchases: 'Purchases',
  cpc: 'CPC',
  ctr: 'CTR',
  clicks: 'Clicks',
  impressions: 'Impressions',
  frequency: 'Frequency',
  cpm: 'CPM',
  link_clicks: 'Link Clicks',
  cplc: 'CPLC',
  reach: 'Reach',
  cost_per_lead: 'Cost/Lead',
  cost_per_purchase: 'Cost/Purchase',
  age_hours: 'Age (hours)',
  age_days: 'Age (days)',
}

const ACTION_LABELS: Record<string, string> = {
  update_budget: 'Update Budget',
  pause_adset: 'Pause Ad Set',
  pause_campaign: 'Pause Campaign',
  resume_adset: 'Resume Ad Set',
  notify: 'Notify',
  scale_budget: 'Scale Budget',
  replace_ad: 'Replace Ad',
}

const OPERATOR_LABELS: Record<string, string> = {
  '>': '>',
  '<': '<',
  '>=': '≥',
  '<=': '≤',
  '==': '=',
  '!=': '≠',
}

function formatMetricValue(metric: string, value: number | string): string {
  if (typeof value === 'string') return value
  if (['roas', 'ctr', 'frequency'].includes(metric)) {
    return metric === 'ctr' ? `${value.toFixed(2)}%` : `${value.toFixed(2)}x`
  }
  if (['spend', 'cpc', 'cpm', 'cplc', 'cost_per_lead', 'cost_per_purchase'].includes(metric)) {
    return `Rp ${value.toLocaleString('id-ID')}`
  }
  return String(value)
}

function formatCondition(condition: Condition): string {
  const metricLabel = METRIC_LABELS[condition.metric] ?? condition.metric
  const opLabel = OPERATOR_LABELS[condition.operator] ?? condition.operator
  const formatted = formatMetricValue(condition.metric, condition.value)
  return `${metricLabel} ${opLabel} ${formatted}`
}

function parseConditionTree(tree: ConditionTree | string): string {
  let parsed: ConditionTree
  if (typeof tree === 'string') {
    try {
      parsed = JSON.parse(tree) as ConditionTree
    } catch {
      return 'Invalid condition'
    }
  } else {
    parsed = tree
  }

  if (!parsed.conditions || parsed.conditions.length === 0) {
    return 'No conditions'
  }

  const parts = parsed.conditions.map((c) => {
    // Check if this is a nested condition tree
    if ('conditions' in c && (c as ConditionTree).operator) {
      return parseConditionTree(c as ConditionTree)
    }
    return formatCondition(c as Condition)
  })

  const operator = parsed.operator ?? 'AND'
  return parts.join(` ${operator} `)
}

function parseActionSpec(spec: ActionSpec | string): string {
  let parsed: ActionSpec
  if (typeof spec === 'string') {
    try {
      parsed = JSON.parse(spec) as ActionSpec
    } catch {
      return 'Unknown action'
    }
  } else {
    parsed = spec
  }

  const actionType = parsed.action ?? ''
  const params: Record<string, unknown> = parsed.params ?? {}

  switch (actionType) {
    case 'update_budget':
    case 'scale_budget': {
      const pct = params.percentage as number | undefined
      const amount = params.fixedAmount as number | undefined
      if (pct !== undefined) {
        return `Budget ${pct > 0 ? '+' : ''}${pct}%`
      }
      if (amount !== undefined) {
        return `Budget → Rp ${Number(amount).toLocaleString('id-ID')}`
      }
      return 'Update Budget'
    }
    case 'pause_adset':
      return 'Pause Ad Set'
    case 'pause_campaign':
      return 'Pause Campaign'
    case 'resume_adset':
      return 'Resume Ad Set'
    case 'notify':
      return `Notify: ${params.kind ?? 'alert'}`
    case 'replace_ad':
      return 'Replace Ad Creative'
    default:
      return ACTION_LABELS[actionType] ?? actionType
  }
}

/**
 * Build a human-readable rule string.
 * Input: conditionTreeJson + actionSpecJson (both parsed or strings).
 * Output: "IF ROAS > 2 AND Spend > Rp 50,000 → Budget +20%"
 */
export function ruleToReadable(
  conditionTreeJson: string | ConditionTree | null | undefined,
  actionSpecJson: string | ActionSpec | null | undefined,
): string {
  if (!conditionTreeJson && !actionSpecJson) return 'Empty rule'

  const condition = conditionTreeJson ? parseConditionTree(conditionTreeJson) : null
  const action = actionSpecJson ? parseActionSpec(actionSpecJson) : null

  if (condition && action) {
    return `IF ${condition} → ${action}`
  }
  if (condition) return `IF ${condition}`
  if (action) return `${action}`
  return 'Empty rule'
}

/**
 * Short one-liner — for table cells / badges.
 * e.g. "ROAS > 2 → +20%" or "Pause if spend > 100k"
 */
export function ruleToShort(
  conditionTreeJson: string | ConditionTree | null | undefined,
  actionSpecJson: string | ActionSpec | null | undefined,
): string {
  const full = ruleToReadable(conditionTreeJson, actionSpecJson)
  if (full.length <= 60) return full
  // Truncate smartly
  const arrowIdx = full.indexOf(' → ')
  if (arrowIdx > 0) {
    const cond = full.slice(3, arrowIdx) // skip "IF "
    const act = full.slice(arrowIdx + 3)
    if (act.length <= 30) return `${cond} → ${act}`
    return `${cond.slice(0, 25)}... → ${act.slice(0, 25)}...`
  }
  return full.length > 60 ? `${full.slice(0, 57)}...` : full
}
