import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
  }

  const agent = await validateHermesApiKey(token)
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })
  }

  // Find instagram_account assignments for this agent
  const accountAssignments = await prisma.assignment.findMany({
    where: {
      hermesAgentId: agent.id,
      assignableType: 'instagram_account',
      status: 'active',
    },
  })

  if (accountAssignments.length === 0) {
    return NextResponse.json({ task: null, reason: 'No assigned accounts' })
  }

  const accountIds = accountAssignments.map(a => a.assignableId)

  // Find accounts with READY_UPLOAD status in PostingMonitor
  const monitors = await prisma.postingMonitor.findMany({
    where: {
      instagramAccountId: { in: accountIds },
      status: 'READY_UPLOAD',
    },
    include: {
      instagramAccount: true,
    },
    orderBy: { lastPostAt: 'asc' },
  })

  if (monitors.length === 0) {
    return NextResponse.json({ task: null, reason: 'No accounts ready for upload' })
  }

  // Priority: accounts that have never posted come first, then oldest last post
  const sorted = monitors.sort((a, b) => {
    if (!a.lastPostAt && b.lastPostAt) return -1
    if (a.lastPostAt && !b.lastPostAt) return 1
    if (!a.lastPostAt && !b.lastPostAt) return 0
    return a.lastPostAt!.getTime() - b.lastPostAt!.getTime()
  })

  const monitor = sorted[0]
  const account = monitor.instagramAccount

  // Get character assigned to this account
  const characterAssignment = await prisma.assignment.findFirst({
    where: {
      hermesAgentId: agent.id,
      assignableType: 'character',
      status: 'active',
    },
  })

  const character = characterAssignment
    ? await prisma.character.findFirst({
        where: {
          id: characterAssignment.assignableId,
          instagramAccountId: account.id,
          status: 'active',
        },
        include: {
          photoReferences: { where: { status: 'active' } },
        },
      })
    : null

  // Get topics assigned to this agent
  const topicAssignments = await prisma.assignment.findMany({
    where: {
      hermesAgentId: agent.id,
      assignableType: 'topic',
      status: 'active',
    },
  })

  const topicIds = topicAssignments.map(a => a.assignableId)

  const topics = await prisma.topic.findMany({
    where: { id: { in: topicIds }, status: 'active' },
    include: {
      photoReferences: { where: { status: 'active' } },
      ceps: { where: { status: 'active' } },
    },
  })

  // Get reference images for this account's character
  const referenceImages = character
    ? await prisma.photoReference.findMany({
        where: {
          characterId: character.id,
          status: 'active',
        },
      })
    : []

  return NextResponse.json({
    task: {
      account: {
        id: account.id,
        username: account.username,
        accountName: account.accountName,
        purpose: account.purpose,
      },
      character,
      topics: topics.map(t => ({
        ...t,
        activeCeps: t.ceps,
      })),
      referenceImages,
      monitor: {
        status: monitor.status,
        lastPostAt: monitor.lastPostAt,
        growthPerHour: monitor.growthPerHour,
      },
    },
  })
}
