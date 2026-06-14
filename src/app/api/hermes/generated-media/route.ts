import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/hermes/generated-media → 307 redirect to /api/gen/media
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  url.pathname = '/api/gen/media'
  return NextResponse.redirect(url, 307)
}
