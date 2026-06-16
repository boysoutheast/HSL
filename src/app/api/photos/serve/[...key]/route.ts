import { NextRequest, NextResponse } from 'next/server'
import { readFile, fileExists } from '@/lib/storage'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { key: string[] } },
) {
  const key = params.key.join('/')
  if (!key) {
    return NextResponse.json({ error: 'Key required' }, { status: 400 })
  }

  if (!(await fileExists(key))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let buf: Buffer
  try {
    buf = await readFile(key)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const ext = key.split('.').pop()?.toLowerCase() ?? ''
  const contentType = MIME_BY_EXT[ext] ?? 'application/octet-stream'

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
  }

  if (contentType.startsWith('video/')) {
    const media = await prisma.generatedMedia.findFirst({
      where: { videoUrl: { endsWith: key } },
      select: { id: true, clientRef: true },
    })
    if (media) {
      headers['X-Content-Job-Id'] = media.id
    }
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers,
  })
}
