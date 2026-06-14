import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/hermes/credits → 307 redirect to /api/gen/credits
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  url.pathname = '/api/gen/credits'
  return NextResponse.redirect(url, 307)
}
