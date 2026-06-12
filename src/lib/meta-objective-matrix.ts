/**
 * Meta Objective Matrix — single source of truth.
 * Maps user-facing objective → MAPI optimization_goal + billing_event + promoted_object rules.
 *
 * Confidence: inferred from MAPI v25 research + v1 confirmed mappings.
 * Final validation by Meta at launch time.
 */

export type MetaObjective = 'OUTCOME_SALES' | 'OUTCOME_LEADS' | 'OUTCOME_TRAFFIC'

export interface ObjectiveConfig {
  optimizationGoal: string
  billingEvent: string
  pixelRequired: boolean
  eventRequired: boolean
  defaultEvent?: string
}

const MATRIX: Record<MetaObjective, ObjectiveConfig> = {
  OUTCOME_SALES: {
    optimizationGoal: 'OFFSITE_CONVERSIONS',
    billingEvent: 'IMPRESSIONS',
    pixelRequired: true,
    eventRequired: true,
  },
  OUTCOME_LEADS: {
    optimizationGoal: 'OFFSITE_CONVERSIONS',
    billingEvent: 'IMPRESSIONS',
    pixelRequired: true,
    eventRequired: false,
    defaultEvent: 'LEAD',
  },
  OUTCOME_TRAFFIC: {
    optimizationGoal: 'LANDING_PAGE_VIEWS',
    billingEvent: 'IMPRESSIONS',
    pixelRequired: false,
    eventRequired: false,
  },
}

export function getObjectiveConfig(objective: string): ObjectiveConfig | null {
  return MATRIX[objective as MetaObjective] ?? null
}

export { MATRIX }
