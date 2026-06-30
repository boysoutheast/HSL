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
  // Nested tree — some formats use 'conditions', others use 'children'
}

interface ConditionTree {
  operator?: string
  op?: string
  type?: string
  conditions?: Condition[] | ConditionTree[]
  children?: Condition[] | ConditionTree[]
}

interface ActionSpec {
  action?: string
  actionType?: string
  mode?: string
  amount?: number
  params?: Record<string, unknown>
  [key: string]: unknown
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
  cpa: 'CPA',
  roas_min_7d: 'ROAS min 7h',
  frequency_max_7d: 'Frequency max 7h',
  cpa_change_pct_3d: 'CPA Δ% 3h',
  adset_age_days: 'Umur adset (hari)',
  days_with_data: 'Hari berdata',
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
  // rule-engine word operators
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
  eq: '=',
  ne: '≠',
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

  // Support multiple formats:
  //   rule-engine: { op: 'AND', children: [...] }
  //   builder:     { type: 'AND', conditions: [...] }
  //   legacy:      { operator: 'AND', conditions: [...] }
  const children = parsed.children ?? parsed.conditions
  const op = parsed.op ?? parsed.type ?? parsed.operator ?? 'AND'

  if (!children || children.length === 0) {
    return 'No conditions'
  }

  const parts = children.map((c) => {
    // Check if this is a nested condition tree
    if ('children' in c || ('conditions' in c && (c as ConditionTree).op) || ('type' in c && (c as ConditionTree).type)) {
      return parseConditionTree(c as ConditionTree)
    }
    return formatCondition(c as Condition)
  })

  return parts.join(` ${op} `)
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

  const actionType = parsed.actionType ?? parsed.action ?? ''
  // Support both formats:
  //   rule-engine: { actionType, mode, amount }
  //   legacy:      { action, params: { percentage, fixedAmount } }
  const params: Record<string, unknown> = parsed.params ?? {}

  const mode = parsed.mode ?? ''
  const amount = parsed.amount

  switch (actionType) {
    case 'update_budget':
    case 'scale_budget':
    case 'UPDATE_BUDGET': {
      // Legacy format: params.percentage
      const pct = params.percentage as number | undefined
      const amount_ = params.fixedAmount as number | undefined
      // Rule-engine format: mode + amount
      const engPct = mode === 'increase_pct' || mode === 'decrease_pct' ? amount : undefined
      if (engPct !== undefined) {
        return `Budget ${mode === 'increase_pct' ? '+' : '-'}${engPct}%`
      }
      if (pct !== undefined) {
        return `Budget ${pct > 0 ? '+' : ''}${pct}%`
      }
      if (amount_ !== undefined) {
        return `Budget → Rp ${Number(amount_).toLocaleString('id-ID')}`
      }
      return 'Update Budget'
    }
    case 'pause_adset':
    case 'PAUSE':
      return actionType === 'PAUSE' ? 'Pause' : 'Pause Ad Set'
    case 'pause_campaign':
    case 'PAUSE_CAMPAIGN':
      return 'Pause Campaign'
    case 'resume_adset':
    case 'RESUME_ADSET':
      return 'Resume Ad Set'
    case 'notify':
    case 'NOTIFY':
      return `Notify: ${params.kind ?? (params.message as string) ?? 'alert'}`
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
