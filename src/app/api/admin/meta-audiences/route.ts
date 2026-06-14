import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/meta-audiences
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const audiences = await prisma.metaAudience.findMany({
    where: auth.role === 'admin' ? {} : { userId: auth.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ audiences })
}

// POST /api/admin/meta-audiences — buat draft audience + WorkerTask untuk eksekusi di Meta
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const { name, type, subtype, metaAdAccountId, description } = body
  if (!name?.trim() || !type || !metaAdAccountId) {
    return NextResponse.json({ error: 'name, type, metaAdAccountId are required' }, { status: 400 })
  }
  if (!['CUSTOM', 'LOOKALIKE'].includes(type)) {
    return NextResponse.json({ error: 'type must be CUSTOM or LOOKALIKE' }, { status: 400 })
  }
  if (type === 'LOOKALIKE') {
    if (!body.sourceAudienceId || !body.lookalikeRatio || !body.lookalikeCountry) {
      return NextResponse.json(
        { error: 'LOOKALIKE requires sourceAudienceId, lookalikeRatio (0.01-0.20), lookalikeCountry' },
        { status: 400 }
      )
    }
    const ratio = Number(body.lookalikeRatio)
    if (ratio < 0.01 || ratio > 0.2) {
      return NextResponse.json({ error: 'lookalikeRatio must be between 0.01 and 0.20' }, { status: 400 })
    }
  }

  // Verify ad account ownership
  const adAccount = await prisma.metaAdAccount.findFirst({
    where: {
      id: metaAdAccountId,
      metaAccount: auth.role === 'admin' ? {} : { userId: auth.id },
    },
    select: { id: true, adAccountId: true },
  })
  if (!adAccount) return NextResponse.json({ error: 'Ad account not found' }, { status: 404 })

  const audience = await prisma.metaAudience.create({
    data: {
      userId: auth.id,
      metaAdAccountId,
      name: name.trim(),
      type,
      subtype: subtype ?? null,
      description: description?.trim() || null,
      sourceAudienceId: body.sourceAudienceId ?? null,
      lookalikeRatio: body.lookalikeRatio ? Number(body.lookalikeRatio) : null,
      lookalikeCountry: body.lookalikeCountry ?? null,
      ruleJson: body.ruleJson ? JSON.stringify(body.ruleJson) : null,
      retentionDays: body.retentionDays ?? null,
      status: 'CREATING',
    },
  })

  // Worker task untuk eksekusi via Meta API
  const task = await prisma.workerTask.create({
    data: {
      type: type === 'LOOKALIKE' ? 'create_lookalike_audience' : 'create_custom_audience',
      capability: 'automation_action',
      payloadJson: JSON.stringify({
        audienceId: audience.id,
        adAccountId: adAccount.adAccountId,
        name: audience.name,
        type,
        subtype,
        sourceAudienceId: body.sourceAudienceId,
        lookalikeRatio: body.lookalikeRatio,
        lookalikeCountry: body.lookalikeCountry,
        ruleJson: body.ruleJson,
        retentionDays: body.retentionDays,
        userId: auth.id,
      }),
      priority: 4,
      scope: 'internal',
    },
  })

  return NextResponse.json({ audience, taskId: task.id }, { status: 201 })
}
