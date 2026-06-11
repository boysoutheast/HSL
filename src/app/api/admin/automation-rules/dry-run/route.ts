import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Condition tree:
// { type: 'AND'|'OR', conditions: [ {metric, operator, value} | nested group ] }
interface Condition {
  metric?: string
  operator?: string
  value?: unknown
  type?: 'AND' | 'OR'
  conditions?: Condition[]
}

const OPERATORS = ['>', '>=', '<', '<=', '=', '!='] as const

function compare(left: number | string | null, operator: string, right: unknown): boolean {
  if (left === null || left === undefined) return false
  const l = typeof left === 'string' ? left : Number(left)
  const r = typeof left === 'string' ? String(right) : Number(right)
  switch (operator) {
    case '>': return Number(l) > Number(r)
    case '>=': return Number(l) >= Number(r)
    case '<': return Number(l) < Number(r)
    case '<=': return Number(l) <= Number(r)
    case '=': return l === r || Number(l) === Number(r)
    case '!=': return l !== r && Number(l) !== Number(r)
    default: return false
  }
}

interface MetricContext {
  [key: string]: number | string | null
}

interface ConditionResult {
  matched: boolean
  details: Array<{ metric: string; operator: string; expected: unknown; actual: unknown; matched: boolean; note?: string }>
}

function evaluateTree(node: Condition, ctx: MetricContext): ConditionResult {
  // Group node
  if (node.type && Array.isArray(node.conditions)) {
    const childResults = node.conditions.map(c => evaluateTree(c, ctx))
    const details = childResults.flatMap(r => r.details)
    const matched = node.type === 'AND'
      ? childResults.every(r => r.matched)
      : childResults.some(r => r.matched)
    return { matched, details }
  }

  // Leaf condition
  const metric = node.metric ?? ''
  const operator = node.operator ?? '='
  if (!OPERATORS.includes(operator as typeof OPERATORS[number])) {
    return { matched: false, details: [{ metric, operator, expected: node.value, actual: null, matched: false, note: 'invalid operator' }] }
  }

  // Metric khusus yang tidak bisa dievaluasi di dry-run
  if (metric === 'consecutive') {
    return { matched: true, details: [{ metric, operator, expected: node.value, actual: 'n/a', matched: true, note: 'consecutive check dilewati di dry-run' }] }
  }

  const actual = ctx[metric] ?? null
  const matched = compare(actual, operator, node.value)
  return { matched, details: [{ metric, operator, expected: node.value, actual, matched }] }
}

// POST /api/admin/automation-rules/dry-run
// Body: { scope, conditionTreeJson, campaignSessionId? }
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  if (!body?.scope || !body?.conditionTreeJson) {
    return NextResponse.json({ error: 'scope and conditionTreeJson are required' }, { status: 400 })
  }

  const tree: Condition = typeof body.conditionTreeJson === 'string'
    ? JSON.parse(body.conditionTreeJson)
    : body.conditionTreeJson

  // Ambil entities dalam scope
  const entities = await prisma.metaEntity.findMany({
    where: {
      userId: auth.id,
      entityType: body.scope,
      ...(body.campaignSessionId ? { campaignSessionId: body.campaignSessionId } : {}),
    },
    take: 100,
    select: {
      id: true,
      name: true,
      metaEntityId: true,
      effectiveStatus: true,
      createdAt: true,
      campaignSession: { select: { id: true, name: true, phase: true } },
    },
  })

  const now = Date.now()
  const results = []

  for (const entity of entities) {
    const snapshot = await prisma.metricSnapshot.findFirst({
      where: { metaEntityId: entity.id },
      orderBy: { windowEnd: 'desc' },
    })

    const ctx: MetricContext = {
      spend: snapshot?.spend ?? null,
      impressions: snapshot?.impressions ?? null,
      clicks: snapshot?.clicks ?? null,
      cpc: snapshot?.cpc ?? null,
      ctr: snapshot?.ctr ?? null,
      cpm: snapshot?.cpm ?? null,
      leads: snapshot?.leads ?? null,
      purchases: snapshot?.purchases ?? null,
      roas: snapshot?.roas ?? null,
      frequency: snapshot?.frequency ?? null,
      age_hours: (now - entity.createdAt.getTime()) / (60 * 60 * 1000),
      phase: entity.campaignSession?.phase ?? null,
      status: entity.effectiveStatus ?? null,
    }

    const evalResult = evaluateTree(tree, ctx)
    results.push({
      entityId: entity.id,
      entityName: entity.name,
      metaEntityId: entity.metaEntityId,
      status: entity.effectiveStatus,
      campaignSession: entity.campaignSession?.name,
      hasMetrics: !!snapshot,
      matched: evalResult.matched,
      details: evalResult.details,
    })
  }

  return NextResponse.json({
    scope: body.scope,
    evaluated: results.length,
    matched: results.filter(r => r.matched).length,
    withoutMetrics: results.filter(r => !r.hasMetrics).length,
    results,
  })
}
