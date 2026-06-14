import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/hermes/generated-media/[id] → 307 redirect to /api/gen/media/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url)
  url.pathname = `/api/gen/media/${params.id}`
  return NextResponse.redirect(url, 307)
}
