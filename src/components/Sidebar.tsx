'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import NotificationBell from './NotificationBell'

interface User { id: string; name: string | null; email: string; role: 'admin' | 'user' }

const I = {
  dash: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>,
  ads: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-2.77.896m0 0a6.023 6.023 0 01-2.77-.896" /></svg>,
  infl: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
  studio: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>,
  approve: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>,
  sys: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
  plus: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>,
  logout: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>,
}

const pillars = [
  { label: 'Dashboard', href: '/', icon: I.dash },
  { label: 'Meta Ads', href: '/ads', icon: I.ads },
  { label: 'Approvals', href: '/approval-requests', icon: I.approve },
  { label: 'Accounts', href: '/influencer', icon: I.infl },
  { label: 'Studio', href: '/media', icon: I.studio },
  { label: 'System', href: '/system', icon: I.sys },
]

export default function Sidebar({ user, onLogout }: { user?: User | null; onLogout?: () => void }) {
  const pathname = usePathname()
  const isAdmin = user?.role === 'admin'
  const initials = (user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()
  const [showCreate, setShowCreate] = useState(false)
  const [badges, setBadges] = useState<{ ads: number; approvals: number; influencer: number }>({ ads: 0, approvals: 0, influencer: 0 })
  const [viewAsUser, setViewAsUser] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    setViewAsUser(sessionStorage.getItem('hsl_viewAsUser') === '1')
  }, [isAdmin])

  function toggleViewAsUser() {
    const next = !viewAsUser
    setViewAsUser(next)
    sessionStorage.setItem('hsl_viewAsUser', next ? '1' : '0')
    window.dispatchEvent(new CustomEvent('hsl_viewAsUser_change', { detail: next }))
  }

  useEffect(() => {
    let live = true
    async function load() {
      try {
        const res = await fetch('/api/admin/nav-badges', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        if (live) setBadges({ ads: Number(data.ads || 0), approvals: Number(data.approvals || 0), influencer: Number(data.influencer || 0) })
      } catch {}
    }
    load()
    const t = setInterval(load, 60_000)
    return () => { live = false; clearInterval(t) }
  }, [])

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/') || pathname.startsWith(href + '?')
  }

  const visiblePillars = pillars

  return (
    <>
      <aside className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0 bg-white border-r border-stone-200">
        <div className="flex items-center justify-between px-4 h-14 border-b border-stone-100 shrink-0">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shadow-sm shrink-0">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-sm font-bold text-stone-900 tracking-tight">Hermes</p>
              <p className="text-[10px] text-stone-400 font-medium">Support Library</p>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button onClick={() => setShowCreate(v => !v)} className="w-7 h-7 rounded-lg bg-violet-100 hover:bg-violet-200 flex items-center justify-center transition-colors" title="Buat">{I.plus}</button>
          </div>
          {showCreate && (
            <div className="absolute left-48 top-3 z-20 w-48 bg-white border border-stone-200 rounded-xl shadow-xl py-1.5">
              <Link href="/ads?tab=launch&new=1" onClick={() => setShowCreate(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">New Launch</Link>
              <Link href="/media?tab=library&upload=1" onClick={() => setShowCreate(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Upload Media</Link>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {visiblePillars.map(p => {
            const active = isActive(p.href)
            const badge = p.label === 'Meta Ads' ? badges.ads : p.label === 'Approvals' ? badges.approvals : p.label === 'Accounts' ? badges.influencer : 0
            const cls = `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-stone-600 hover:bg-stone-50'}`
            return (
              <Link key={p.href} href={p.href} className={cls}>
                {p.icon}
                <span className="flex-1">{p.label}</span>
                {badge > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold flex items-center justify-center">{badge}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-stone-100 p-2 space-y-1 shrink-0">
          {user && <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg"><div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0"><span className="text-[10px] font-bold text-violet-700">{initials}</span></div><div className="flex-1 min-w-0"><p className="text-xs font-medium text-stone-700 truncate">{user.name ?? user.email}</p><p className="text-[10px] text-stone-400 capitalize">{user.role}</p></div></div>}
          {isAdmin && (
            <button onClick={toggleViewAsUser} title={viewAsUser ? 'Kembali ke mode Admin' : 'Lihat tampilan sebagai User'}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors ${viewAsUser ? 'bg-amber-50 text-amber-700 font-medium' : 'text-stone-400 hover:bg-stone-50'}`}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {viewAsUser ? 'User View (aktif)' : 'View as User'}
            </button>
          )}
          {onLogout && <button onClick={onLogout} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">{I.logout} Sign out</button>}
        </div>
      </aside>

      <button onClick={() => setShowCreate(v => !v)} className="md:hidden fixed right-4 bottom-24 z-50 w-14 h-14 rounded-full bg-violet-600 text-white shadow-xl flex items-center justify-center">{I.plus}</button>
      {showCreate && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={() => setShowCreate(false)} />
          <div className="fixed right-4 bottom-40 z-50 w-52 bg-white border border-stone-200 rounded-2xl shadow-2xl py-2 md:hidden">
            <Link href="/ads?tab=launch&new=1" onClick={() => setShowCreate(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">New Launch</Link>
            <Link href="/media?tab=library&upload=1" onClick={() => setShowCreate(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Upload Media</Link>
          </div>
        </>
      )}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-stone-200 safe-pb">
        <div className="grid grid-cols-6">
          {visiblePillars.map((p) => {
            const active = isActive(p.href)
            const cls = `flex flex-col items-center justify-center gap-1 py-3 text-[11px] ${active ? 'text-violet-700 font-semibold' : 'text-stone-500'}`
            return (
              <Link key={p.href} href={p.href} className={cls}>
                {p.icon}
                <span>{p.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
