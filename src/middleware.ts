import { NextRequest, NextResponse } from 'next/server'

// Cookie name must match src/lib/session.ts SESSION_COOKIE
const SESSION_COOKIE = 'hermes_session'

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/docs',
  '/api/admin/auth/login',
  '/api/admin/auth/logout',
  '/api/admin/auth/register',
  '/api/admin/auth/google',
  '/api/health',
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Canonical domain: akses via *.up.railway.app → redirect permanen ke domain utama.
  // Guard anti-loop: skip kalau canonical host sama dengan host sekarang
  // (mis. NEXT_PUBLIC_BASE_URL masih berisi URL railway).
  const canonical = process.env.NEXT_PUBLIC_BASE_URL
  const host = req.headers.get('host') ?? ''
  if (canonical && host.endsWith('.up.railway.app')) {
    try {
      const canonicalHost = new URL(canonical).host
      if (canonicalHost && canonicalHost !== host && !canonicalHost.endsWith('.up.railway.app')) {
        const target = new URL(req.nextUrl.pathname + req.nextUrl.search, canonical)
        return NextResponse.redirect(target, 308)
      }
    } catch { /* canonical bukan URL valid — skip redirect */ }
  }

  // Public routes — no auth needed
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Static assets + Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Hermes API (Bearer token auth handled inside route handlers)
  // Worker API (x-api-key auth handled inside route handlers)
  // CAPI proxy (configId auth handled inside route handler)
  if (
    pathname.startsWith('/api/hermes/') ||
    pathname.startsWith('/api/photos/') ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/worker/') ||
    pathname.startsWith('/api/internal/') ||
    pathname.startsWith('/api/capi/') ||
    pathname.startsWith('/api/webhooks/')
  ) {
    return NextResponse.next()
  }

  // Check session cookie presence (DB validation happens in route handlers)
  const token = req.cookies.get(SESSION_COOKIE)?.value

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Logged-in user visiting /login or /register → redirect to dashboard
  if (pathname === '/login' || pathname === '/register') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
