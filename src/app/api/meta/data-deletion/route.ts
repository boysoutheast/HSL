import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return Buffer.from(padded, 'base64').toString('utf8')
}

function parseSignedRequest(signedRequest: string, appSecret: string): { userId: string } | null {
  try {
    const [encodedSig, encodedPayload] = signedRequest.split('.', 2)
    if (!encodedSig || !encodedPayload) return null

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', appSecret)
      .update(encodedPayload)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    if (encodedSig !== expectedSig) return null

    // Decode payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload))
    if (!payload.user_id) return null

    return { userId: payload.user_id }
  } catch {
    return null
  }
}

/**
 * POST /api/meta/data-deletion
 * Facebook Data Deletion Request Callback.
 *
 * Facebook sends a signed_request when a user requests data deletion.
 * We verify the signature, extract the user_id, and return a confirmation
 * code + status URL.
 */
export async function POST(req: NextRequest) {
  const appSecret = process.env.META_APP_SECRET

  if (!appSecret) {
    console.error('[meta/data-deletion] META_APP_SECRET not configured')
    return NextResponse.json(
      { error: 'Configuration error' },
      { status: 500 }
    )
  }

  let body: { signed_request?: string }
  try {
    body = await req.json()
  } catch {
    // Facebook may send as form-encoded
    try {
      const text = await req.text()
      const params = new URLSearchParams(text)
      const sr = params.get('signed_request')
      body = sr ? { signed_request: sr } : {}
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }
  }

  const signedRequest = body.signed_request
  if (!signedRequest) {
    return NextResponse.json(
      { error: 'Missing signed_request' },
      { status: 400 }
    )
  }

  const parsed = parseSignedRequest(signedRequest, appSecret)
  if (!parsed) {
    return NextResponse.json(
      { error: 'Invalid signed_request' },
      { status: 400 }
    )
  }

  const confirmationCode = crypto.randomBytes(16).toString('hex')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai.boytenggara.com'

  console.log(
    `[meta/data-deletion] Deletion request received for user_id=${parsed.userId}, code=${confirmationCode}`
  )

  return NextResponse.json({
    url: `${baseUrl}/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  })
}
