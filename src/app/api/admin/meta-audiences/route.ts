import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { metaPost, TokenError, RateLimitError } from '@/lib/meta-client'
import { canWriteToAdAccount, markAccountHealthy, markAccountNeedsReconnect } from '@/lib/write-guard'

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

// POST /api/admin/meta-audiences — create audience langsung di Meta API (SaaS, no worker)
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

  // Execute directly via Meta API
  try {
    // Write gate: token + ownership
    const writeCheck = await canWriteToAdAccount(auth.id, metaAdAccountId)
    if (!writeCheck.ok) {
      throw new Error(writeCheck.reason ?? 'Write access denied')
    }
    const token = writeCheck.token!
    await markAccountHealthy(metaAdAccountId)

    const adAccountIdNum = adAccount.adAccountId.replace(/^act_/, '')

    if (type === 'CUSTOM') {
      // POST /act_{adAccountId}/customaudiences
      const postBody: Record<string, string> = {
        name: audience.name,
        subtype: subtype ?? 'CUSTOM',
        description: description?.trim() || audience.name,
        customer_file_source: 'USER_PROVIDED_ONLY',
      }
      if (body.ruleJson) postBody.rule = JSON.stringify(body.ruleJson)
      if (body.retentionDays) postBody.retention_days = String(body.retentionDays)

      const { data } = await metaPost(`act_${adAccountIdNum}/customaudiences`, token, postBody)
      const result = data as { id: string }

      await prisma.metaAudience.update({
        where: { id: audience.id },
        data: { metaAudienceId: result.id, status: 'READY', lastSyncedAt: new Date() },
      })
    } else {
      // LOOKALIKE
      const lookalikeSpec = JSON.stringify({
        ratio: Number(body.lookalikeRatio),
        country: body.lookalikeCountry,
      })

      const { data } = await metaPost(`act_${adAccountIdNum}/customaudiences`, token, {
        name: audience.name,
        subtype: 'LOOKALIKE',
        origin_audience_id: body.sourceAudienceId,
        lookalike_spec: lookalikeSpec,
      })
      const result = data as { id: string }

      await prisma.metaAudience.update({
        where: { id: audience.id },
        data: { metaAudienceId: result.id, status: 'READY', lastSyncedAt: new Date() },
      })
    }
  } catch (err: any) {
    const errorMessage = err instanceof TokenError
      ? 'Token error — reconnect needed'
      : err instanceof RateLimitError
        ? 'Meta rate limited — try later'
        : err?.message ?? 'Unknown error'

    if (err instanceof TokenError) {
      await markAccountNeedsReconnect(metaAdAccountId)
    }

    await prisma.metaAudience.update({
      where: { id: audience.id },
      data: { status: 'FAILED', errorMessage },
    })

    return NextResponse.json({
      audience: await prisma.metaAudience.findUnique({ where: { id: audience.id } }),
      error: errorMessage,
    }, { status: 500 })
  }

  return NextResponse.json({
    audience: await prisma.metaAudience.findUnique({ where: { id: audience.id } }),
  }, { status: 201 })
}
