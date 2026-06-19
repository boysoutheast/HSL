'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface NotificationItem {
  id: string
  type: string
  severity: string
  title: string
  body: string | null
  refType: string | null
  refId: string | null
  readAt: string | null
  createdAt: string
}

const SEVERITY_ICONS: Record<string, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'baru saja'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}j`
  const days = Math.floor(hours / 24)
  return `${days}h`
}

function getRefHref(refType: string | null, refId: string | null): string | null {
  if (!refType || !refId) return null
  if (refType === 'campaign_session') return `/campaign-monitor/${refId}`
  if (refType === 'meta_account') return `/system?tab=connections`
  return null
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  function load() {
    fetch('/api/admin/notifications?unread=true&limit=10', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.data) return
        setNotifications(d.data)
        setUnreadCount(d.data.length)
      })
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markAllRead() {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    setOpen(false)
    setUnreadCount(0)
    setNotifications([])
  }

  async function markOneRead(id: string) {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setNotifications(prev => prev.filter(n => n.id !== id))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(v => !v); if (!open) load() }}
        className="relative w-7 h-7 rounded-lg hover:bg-stone-100 flex items-center justify-center transition-colors"
        title="Notifikasi"
      >
        <svg className="w-4 h-4 text-stone-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-80 bg-white border border-stone-200 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
            <h3 className="text-sm font-semibold text-stone-900">Notifikasi</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-violet-600 hover:text-violet-700 font-medium">
                Tandai dibaca
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-stone-400">
                {unreadCount > 0 ? 'Memuat...' : 'Tidak ada notifikasi'}
              </div>
            ) : (
              notifications.map(n => {
                const href = getRefHref(n.refType, n.refId)
                const content = (
                  <div className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-stone-50 transition-colors cursor-pointer border-b border-stone-50 last:border-0">
                    <span className="text-sm shrink-0 mt-0.5">{SEVERITY_ICONS[n.severity] ?? 'ℹ️'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">{n.title}</p>
                      {n.body && <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[11px] text-stone-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); markOneRead(n.id) }}
                      className="shrink-0 w-2 h-2 rounded-full bg-violet-400 hover:bg-violet-600 mt-1.5"
                      title="Tandai dibaca"
                    />
                  </div>
                )
                return href ? (
                  <Link key={n.id} href={href} onClick={() => { markOneRead(n.id); setOpen(false) }}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id} onClick={() => markOneRead(n.id)}>{content}</div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
