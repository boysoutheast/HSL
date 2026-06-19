import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/campaign-sessions/[id]/rules
 * List AutomationRules attached to this campaign session.
 * Includes status, lastFiredAt, fireCount.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Verify session ownership
  const session = await prisma.campaignSession.findFirst({
    where: { id: params.id, userId: auth.id },
    select: { id: true },
  })
  if (!session) {
    return NextResponse.json({ error: 'Campaign session not found' }, { status: 404 })
  }

  const rules = await prisma.automationRule.findMany({
    where: { campaignSessionId: params.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      scope: true,
      ruleCategory: true,
      conditionTreeJson: true,
      actionSpecJson: true,
      sourceTemplateId: true,
      cooldownMinutes: true,
      evaluationWindowMinutes: true,
      priority: true,
      fireCount: true,
      lastFiredAt: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ rules })
}

/**
 * POST /api/admin/campaign-sessions/[id]/rules
 * Attach a RuleTemplate to this session — instantiates as ACTIVE AutomationRule.
 * Body: { templateId, overrides?: { cooldownMinutes?, evaluationWindowMinutes?, priority? } }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    templateId: string
    overrides?: {
      cooldownMinutes?: number
      evaluationWindowMinutes?: number
      priority?: number
    }
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.templateId) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
  }

  // Verify session ownership
  const session = await prisma.campaignSession.findFirst({
    where: { id: params.id, userId: auth.id },
    select: { id: true },
  })
  if (!session) {
    return NextResponse.json({ error: 'Campaign session not found' }, { status: 404 })
  }

  // Load template — built-in (userId null) OK, user template must match userId
  const template = await prisma.ruleTemplate.findUnique({
    where: { id: body.templateId },
  })
  if (!template) {
    return NextResponse.json({ error: 'Rule template not found' }, { status: 404 })
  }
  if (template.userId !== null && template.userId !== auth.id) {
    return NextResponse.json({ error: 'Rule template belongs to another user' }, { status: 403 })
  }

  const cooldown = body.overrides?.cooldownMinutes ?? 60
  const evalWindow = body.overrides?.evaluationWindowMinutes ?? null
  const priority = body.overrides?.priority ?? 5

  // Create the AutomationRule — instantiate as ACTIVE
  const rule = await prisma.automationRule.create({
    data: {
      userId: auth.id,
      campaignSessionId: params.id,
      name: template.name,
      description: template.description,
      scope: template.scope,
      ruleCategory: template.ruleCategory,
      conditionTreeJson: template.conditionTreeJson,
      actionSpecJson: template.actionSpecJson,
      sourceTemplateId: body.templateId,
      cooldownMinutes: cooldown,
      evaluationWindowMinutes: evalWindow,
      priority,
      status: 'ACTIVE',
    },
  })

  // Increment template usageCount
  await prisma.ruleTemplate.update({
    where: { id: body.templateId },
    data: { usageCount: { increment: 1 } },
  })

  return NextResponse.json({ rule }, { status: 201 })
}

/**
 * DELETE /api/admin/campaign-sessions/[id]/rules/[ruleId]
 * Detach a rule by setting status to ARCHIVED (soft-delete — preserves RuleExecution history).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const ruleId = req.nextUrl.searchParams.get('ruleId')
  if (!ruleId) {
    return NextResponse.json({ error: 'ruleId query param is required' }, { status: 400 })
  }

  // Verify session + rule ownership
  const session = await prisma.campaignSession.findFirst({
    where: { id: params.id, userId: auth.id },
    select: { id: true },
  })
  if (!session) {
    return NextResponse.json({ error: 'Campaign session not found' }, { status: 404 })
  }

  const rule = await prisma.automationRule.findFirst({
    where: { id: ruleId, campaignSessionId: params.id, userId: auth.id },
    select: { id: true },
  })
  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  // Soft-delete: ARCHIVED
  await prisma.automationRule.update({
    where: { id: ruleId },
    data: { status: 'ARCHIVED' },
  })

  return NextResponse.json({ success: true })
}
