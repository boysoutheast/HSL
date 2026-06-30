'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import NotificationBell from './NotificationBell'
import { LogoMark } from '@/components/Logo'

interface User { id: string; name: string | null; email: string; role: 'admin' | 'user' }

const I = {
  dash: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>,
  ads: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-2.77.896m0 0a6.023 6.023 0 01-2.77-.896" /></svg>,
  lab: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>,
  studio: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>,
  lib: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>,
  approve: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>,
  sys: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
  link: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  plus: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>,
  logout: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>,
}

const pillars = [
  { label: 'Dashboard', href: '/', icon: I.dash },
  { label: 'Testing Lab', href: '/ads?tab=testing', icon: I.lab },
  { label: 'Campaigns', href: '/ads', icon: I.ads },
  { label: 'Studio', href: '/media', icon: I.studio },
  { label: 'Library', href: '/products', icon: I.lib },
  { label: 'Akun Meta', href: '/meta-connections', icon: I.link },
  { label: 'Approvals', href: '/approval-requests', icon: I.approve },
  { label: 'System', href: '/system', icon: I.sys },
]

const librarySubLinks = [
  { label: 'Products', href: '/products' },
  { label: 'CEPs', href: '/ceps' },
  { label: 'Characters', href: '/characters' },
  { label: 'Topics', href: '/topics' },
]

function SidebarBody({ user, onLogout, activeTab }: { user?: User | null; onLogout?: () => void; activeTab: string | null }) {
  const pathname = usePathname()
  const isAdmin = user?.role === 'admin'
  const initials = (user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()
  const [showCreate, setShowCreate] = useState(false)
  const [badges, setBadges] = useState<{ ads: number; approvals: number; influencer: number }>({ ads: 0, approvals: 0, influencer: 0 })
  const [viewAsUser, setViewAsUser] = useState(false)
  const [libOpen, setLibOpen] = useState(false)

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
    return pathname === href || pathname.startsWith(href + '/')
  }

  // Testing Lab and Campaigns share /ads — disambiguate by ?tab
  function pillarActive(href: string) {
    if (href === '/ads?tab=testing') return pathname === '/ads' && activeTab === 'testing'
    if (href === '/ads') return pathname === '/ads' && activeTab !== 'testing'
    return isActive(href)
  }

  const visiblePillars = pillars

  return (
    <>
      <aside className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0 bg-white border-r border-stone-200">
        <div className="flex items-center justify-between px-4 h-14 border-b border-stone-100 shrink-0">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 text-violet-600 shrink-0">
              <LogoMark className="w-7 h-7" />
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-sm font-bold text-stone-900 tracking-tight">AI Buddy</p>
              <p className="text-[10px] text-stone-400 font-medium">Ads Automation</p>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button onClick={() => setShowCreate(v => !v)} className="w-7 h-7 rounded-lg bg-violet-100 hover:bg-violet-200 flex items-center justify-center transition-colors" title="Buat">{I.plus}</button>
          </div>
          {showCreate && (
            <div className="absolute left-48 top-3 z-20 w-48 bg-white border border-stone-200 rounded-xl shadow-xl py-1.5">
              <Link href="/ads?tab=launch&new=1" onClick={() => setShowCreate(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">New Launch</Link>
              <Link href="/campaign-monitor/import" onClick={() => setShowCreate(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Import Campaign</Link>
              <Link href="/media?tab=library&upload=1" onClick={() => setShowCreate(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Upload Media</Link>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {visiblePillars.map(p => {
            const active = pillarActive(p.href)
            const badge = p.label === 'Campaigns' ? badges.ads : p.label === 'Approvals' ? badges.approvals : 0
            const cls = `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-stone-600 hover:bg-stone-50'}`
            return (
              <div key={p.href}>
                <Link href={p.href} className={cls}>
                  {p.icon}
                  <span className="flex-1">{p.label}</span>
                  {badge > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold flex items-center justify-center">{badge}</span>}
                </Link>
                {p.label === 'Library' && (
                  <div className="ml-6 mt-0.5 space-y-0.5">
                    {librarySubLinks.map(sub => {
                      const subActive = isActive(sub.href)
                      return (
                        <Link key={sub.href} href={sub.href}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${subActive ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}>
                          {sub.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
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
        <div className="grid grid-cols-5">
          {visiblePillars.slice(0, 5).map((p) => {
            const active = pillarActive(p.href)
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

// useSearchParams must live inside a Suspense boundary, else it forces every
// page in this layout to bail out of prerendering. Fallback renders the full
// sidebar (activeTab=null) so there is no flash.
function SidebarWithTab(props: { user?: User | null; onLogout?: () => void }) {
  const activeTab = useSearchParams().get('tab')
  return <SidebarBody {...props} activeTab={activeTab} />
}

export default function Sidebar(props: { user?: User | null; onLogout?: () => void }) {
  return (
    <Suspense fallback={<SidebarBody {...props} activeTab={null} />}>
      <SidebarWithTab {...props} />
    </Suspense>
  )
}
