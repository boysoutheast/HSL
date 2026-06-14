import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/hermes/generate/video → 307 redirect to /api/gen/video
export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  url.pathname = '/api/gen/video'
  return NextResponse.redirect(url, 307)
}
