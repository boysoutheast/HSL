'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

interface User { id: string; name: string | null; email: string; role: 'admin' | 'user' }

const I = {
  dash: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>,
  ads: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-2.77.896m0 0a6.023 6.023 0 01-2.77-.896" /></svg>,
  infl: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
  media: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>,
  sys: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
  plus: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>,
  gear: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  logout: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>,
}

const pillars = [
  { label: 'Dashboard', href: '/', icon: I.dash },
  { label: 'Ads', href: '/ads', icon: I.ads },
  { label: 'Influencer', href: '/influencer', icon: I.infl },
  { label: 'Media', href: '/media', icon: I.media },
  { label: 'System', href: '/system', icon: I.sys, adminOnly: true },
]

export default function Sidebar({ user, onLogout }: { user?: User | null; onLogout?: () => void }) {
  const pathname = usePathname()
  const isAdmin = user?.role === 'admin'
  const initials = (user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()
  const [showCreate, setShowCreate] = useState(false)

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/') || pathname.startsWith(href + '?')
  }

  return (
    <aside className="flex flex-col w-56 shrink-0 h-screen sticky top-0 bg-white border-r border-stone-200">
      {/* Brand + Create */}
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
        <div className="relative">
          <button onClick={() => setShowCreate(v => !v)} className="w-7 h-7 rounded-lg bg-violet-100 hover:bg-violet-200 flex items-center justify-center transition-colors" title="Buat">
            {I.plus}
          </button>
          {showCreate && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowCreate(false)} />
              <div className="absolute right-0 top-9 z-20 w-48 bg-white border border-stone-200 rounded-xl shadow-xl py-1.5">
                <Link href="/ads?tab=launch&new=1" onClick={() => setShowCreate(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">New Launch</Link>
                <Link href="/media?tab=library&upload=1" onClick={() => setShowCreate(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Upload Media</Link>
                <span className="block px-4 py-2 text-sm text-stone-400 cursor-not-allowed">Generate Konten <span className="text-[10px] ml-1">(coming soon)</span></span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pillars */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {pillars.map(p => {
          if (p.adminOnly && !isAdmin) return null
          const active = isActive(p.href)
          return (
            <Link key={p.href} href={p.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-stone-600 hover:bg-stone-50'
              }`}>
              {p.icon}
              <span>{p.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-stone-100 p-2 space-y-1 shrink-0">
        {user && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-violet-700">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-stone-700 truncate">{user.name ?? user.email}</p>
              <p className="text-[10px] text-stone-400 capitalize">{user.role}</p>
            </div>
          </div>
        )}
        <Link href="/settings" className="flex items-center gap-2 px-2 py-1.5 text-xs text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-lg transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Ganti password
        </Link>
        {onLogout && (
          <button onClick={onLogout} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            {I.logout} Sign out
          </button>
        )}
      </div>
    </aside>
  )
}