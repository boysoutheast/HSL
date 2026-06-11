'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'

interface CurrentUser {
  id: string
  name: string | null
  email: string
  role: 'admin' | 'user'
}

const NO_SHELL_PATHS = ['/login', '/register', '/docs']

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

  if (noShell) return <>{children}</>

  return (
    <div className="flex min-h-screen bg-[#f8f7f6] dark:bg-stone-950">
      <Sidebar user={currentUser} onLogout={handleLogout} />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
