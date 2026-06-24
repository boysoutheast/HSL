'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import CommandPalette from './CommandPalette'

interface CurrentUser {
  id: string
  name: string | null
  email: string
  role: 'admin' | 'user'
  emailVerified?: boolean
}

const NO_SHELL_PATHS = ['/login', '/register', '/docs', '/forgot-password', '/reset-password']

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  const noShell = NO_SHELL_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))

  useEffect(() => {
    if (noShell) return
    fetch('/api/admin/auth/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.user) setCurrentUser(d.user) })
      .catch(() => {})
  }, [noShell])

  async function handleLogout() {
    await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/login')
    router.refresh()
  }

  async function handleResendVerification() {
    if (!currentUser?.email) return
    await fetch('/api/admin/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser.email }),
    })
    alert('Link verifikasi sudah dikirim ke email Anda.')
  }

  if (noShell) return <>{children}</>

  return (
    <div className="flex min-h-screen bg-[#f8f7f6] dark:bg-stone-950">
      <Sidebar user={currentUser} onLogout={handleLogout} />
      <CommandPalette />
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        {/* Email verification banner — jangan kunci login */}
        {currentUser && currentUser.emailVerified === false && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 md:px-6 py-2.5">
            <div className="max-w-6xl mx-auto flex items-center gap-2 text-sm text-yellow-800">
              <span>📧 Email belum diverifikasi.</span>
              <button
                onClick={handleResendVerification}
                className="underline font-medium hover:text-yellow-900"
              >
                Kirim ulang link verifikasi
              </button>
            </div>
          </div>
        )}
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 pb-28 md:pb-6">
          {children}
        </div>
      </main>
    </div>
  )
}
