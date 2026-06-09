import { NextRequest, NextResponse } from 'next/server'
import { encode, decode } from '@/lib/crypto'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ── OAuth 2.0 configuration ──
const FB_OAUTH = 'https://www.facebook.com/v21.0/dialog/oauth'
const GRAPH = 'https://graph.facebook.com/v21.0'
const REDIRECT_BASE = process.env.RAILWAY_STATIC_URL
  ? `https://${process.env.RAILWAY_STATIC_URL}`
  : process.env.APP_URL ?? 'http://localhost:3000'

// ── Scopes per type ──
const SCOPES: Record<string, string> = {
  fanpage: [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'pages_manage_comments',
    'pages_messaging',
    'business_management',
    'public_profile',
  ].join(','),
  instagram: [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'pages_manage_comments',
    'pages_messaging',
    'business_management',
    'instagram_basic',
    'instagram_manage_comments',
    'instagram_manage_messages',
    'instagram_content_publish',
    'public_profile',
  ].join(','),
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'fanpage'
  const userId = searchParams.get('userId') ?? ''
  const metaAccountId = searchParams.get('metaAccountId') ?? ''

  if (!SCOPES[type]) {
    return NextResponse.json({ error: 'Invalid oauth type. Use fanpage or instagram.' }, { status: 400 })
  }

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  // Load app credentials from existing MetaAccount or env
  let appId = process.env.META_APP_ID
  let appSecret = process.env.META_APP_SECRET

  if (metaAccountId) {
    const acct = await prisma.metaAccount.findUnique({ where: { id: metaAccountId } })
    if (acct) {
      appId = acct.appId
      appSecret = acct.appSecretEncrypted ? decode(acct.appSecretEncrypted) : undefined
    }
  }

  if (!appId) {
    return NextResponse.json({ error: 'No App ID configured. Set META_APP_ID env or connect Meta first.' }, { status: 400 })
  }

  const callbackUrl = `${REDIRECT_BASE}/api/admin/auth/meta/callback`
  const state = JSON.stringify({
    userId,
    metaAccountId: metaAccountId || null,
    type,
    appId,
    appSecret: appSecret || '',
    redirectBase: REDIRECT_BASE,
  })
  const stateEncrypted = encode(state)

  const oauthUrl = new URL(FB_OAUTH)
  oauthUrl.searchParams.set('client_id', appId)
  oauthUrl.searchParams.set('redirect_uri', callbackUrl)
  oauthUrl.searchParams.set('scope', SCOPES[type])
  oauthUrl.searchParams.set('response_type', 'code')
  oauthUrl.searchParams.set('state', stateEncrypted)

  return NextResponse.json({
    redirectUrl: oauthUrl.toString(),
    callbackUrl,
    state: stateEncrypted,
    type,
    scope: SCOPES[type],
  })
}
