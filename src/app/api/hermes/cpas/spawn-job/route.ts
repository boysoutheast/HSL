import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const agent = await validateHermesApiKey(token)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    userId: string
    productKey: string
    campaignSessionId: string
    cepData: {
      painText: string
      exchangeValue: string
      deliveryStyle: string
      hookDirection: string
      adsetNaming: string
      cepText: string
    }
    referencePhotoUrl?: string
    productId?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const required = ['userId', 'productKey', 'campaignSessionId', 'cepData']
  for (const f of required) {
    if (!body[f as keyof typeof body]) {
      return NextResponse.json({ error: `Missing required field: ${f}` }, { status: 400 })
    }
  }

  const [cep, workerTask] = await prisma.$transaction(async (tx) => {
    const newCep = await tx.cep.create({
      data: {
        productId: body.productId ?? null,
        cepText: body.cepData.cepText,
        painPoint: body.cepData.painText,
        source: 'cpas_llm',
        exchangeValue: body.cepData.exchangeValue,
        deliveryStyle: body.cepData.deliveryStyle,
        hookDirection: body.cepData.hookDirection,
        adsetNaming: body.cepData.adsetNaming,
      },
    })

    const payload = {
      campaignSessionId: body.campaignSessionId,
      cepId: newCep.id,
      productKey: body.productKey,
      referencePhotoUrl: body.referencePhotoUrl ?? null,
    }

    const task = await tx.workerTask.create({
      data: {
        type: 'cpas_spawn_plan',
        capability: 'cpas-planner',
        payloadJson: JSON.stringify(payload),
        priority: 3,
        scope: 'internal',
        ownerUserId: body.userId,
      },
    })

    await tx.cep.update({
      where: { id: newCep.id },
      data: { spawnJobId: task.id },
    })

    return [newCep, task]
  })

  return NextResponse.json({ workerTaskId: workerTask.id, cepId: cep.id }, { status: 201 })
}
