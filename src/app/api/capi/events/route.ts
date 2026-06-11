import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decode } from '@/lib/crypto'
import { sendCapiEvents, type CapiEvent } from '@/lib/meta-graph'

export const dynamic = 'force-dynamic'

// POST /api/capi/events — CAPI proxy publik (auth via configId yang unguessable)
// Body: { configId: string, events: CapiEvent[] }
// Dipasang di landing page / server client untuk kirim conversion ke Meta tanpa expose token.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.configId || !Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json({ error: 'configId and events[] are required' }, { status: 400 })
  }
  if (body.events.length > 100) {
    return NextResponse.json({ error: 'Max 100 events per request' }, { status: 400 })
  }

  const config = await prisma.capiEventConfig.findFirst({
    where: { id: body.configId, isActive: true },
  })
  if (!config) {
    return NextResponse.json({ error: 'Config not found or inactive' }, { status: 404 })
  }

  // Validasi & sanitasi event
  const nowSec = Math.floor(Date.now() / 1000)
  const events: CapiEvent[] = []
  for (const ev of body.events) {
    if (!ev.event_name || !config.allowedEvents.includes(ev.event_name)) {
      return NextResponse.json(
        { error: `Event "${ev.event_name}" not allowed. Allowed: ${config.allowedEvents.join(', ')}` },
        { status: 400 }
      )
    }
    events.push({
      event_name: ev.event_name,
      event_time: typeof ev.event_time === 'number' ? ev.event_time : nowSec,
      event_id: ev.event_id,
      event_source_url: ev.event_source_url,
      action_source: ev.action_source ?? 'website',
      user_data: {
        ...ev.user_data,
        client_ip_address: ev.user_data?.client_ip_address
          ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? undefined,
        client_user_agent: ev.user_data?.client_user_agent
          ?? req.headers.get('user-agent')
          ?? undefined,
      },
      custom_data: ev.custom_data,
    })
  }

  try {
    const token = decode(config.accessTokenEncrypted)
    const result = await sendCapiEvents(config.pixelId, token, events, config.testEventCode)

    await prisma.capiEventConfig.update({
      where: { id: config.id },
      data: {
        eventCount: { increment: events.length },
        lastEventAt: new Date(),
        lastError: null,
      },
    })

    // Auto-record ke LandingPageStat kalau config terhubung ke LP
    if (config.landingPageId) {
      const conversions = events.filter(e => ['Purchase', 'Lead'].includes(e.event_name)).length
      const clicks = events.filter(e => ['PageView', 'ViewContent'].includes(e.event_name)).length
      const revenue = events.reduce((sum, e) => {
        const v = e.custom_data?.value
        return sum + (typeof v === 'number' ? v : 0)
      }, 0)

      if (conversions > 0 || clicks > 0) {
        await prisma.landingPageStat.create({
          data: {
            landingPageId: config.landingPageId,
            source: 'capi',
            sourceRefId: config.id,
            clicks,
            conversions,
            revenue,
            conversionRate: clicks > 0 ? (conversions / clicks) * 100 : null,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      eventsReceived: result.events_received ?? events.length,
      fbtraceId: result.fbtrace_id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'CAPI forward failed'
    await prisma.capiEventConfig.update({
      where: { id: config.id },
      data: { lastError: message.slice(0, 1000) },
    })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
