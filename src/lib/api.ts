/**
 * Wrapper fetch untuk semua admin API calls.
 * - Otomatis redirect ke /login jika dapat 401
 * - Throw error dengan message yang jelas kalau response not ok
 */
export async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: 'include' })

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
    }
    throw new Error('Session expired — redirecting to login')
  }

  return res
}

/**
 * apiFetch + auto-parse JSON + throw on error response
 */
export async function apiJson<T = unknown>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const res = await apiFetch(input, init)

  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new Error(`HTTP ${res.status} — invalid JSON response`)
  }

  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? `HTTP ${res.status}`
    throw new Error(msg)
  }

  return data as T
}
