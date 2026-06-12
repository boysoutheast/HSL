'use client'

import { useState } from 'react'

interface Tab {
  id: string
  label: string
}

/**
 * Client-side keep-alive tabs.
 * - Pindah tab = instant (no server roundtrip)
 * - Panel di-mount saat pertama dibuka, lalu disembunyikan (bukan unmount)
 *   sehingga data fetch per tab cuma sekali
 * - URL ?tab= disinkronkan via history.replaceState (deep link tetap jalan
 *   karena initial dari server searchParams)
 */
export default function ClientTabs({
  tabs,
  panels,
  initial,
  basePath,
  compact = false,
}: {
  tabs: Tab[]
  panels: Record<string, React.ReactNode>
  initial: string
  basePath?: string // tanpa basePath = sub-tabs, URL tidak disentuh
  compact?: boolean
}) {
  const [active, setActive] = useState(initial)
  const [mounted, setMounted] = useState<Set<string>>(new Set([initial]))

  function switchTab(id: string) {
    setActive(id)
    setMounted(prev => (prev.has(id) ? prev : new Set(prev).add(id)))
    if (basePath) window.history.replaceState(null, '', `${basePath}?tab=${id}`)
  }

  return (
    <div className="space-y-5">
      <div className={compact ? 'flex flex-wrap gap-2' : 'flex flex-wrap gap-2 border-b border-stone-200 pb-3'}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={
              compact
                ? `px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    active === t.id
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'
                  }`
                : `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    active === t.id
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                  }`
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>
        {tabs.map(t =>
          mounted.has(t.id) ? (
            <div key={t.id} style={{ display: active === t.id ? undefined : 'none' }}>
              {panels[t.id]}
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}
