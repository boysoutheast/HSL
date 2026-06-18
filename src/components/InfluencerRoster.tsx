'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AddAccountModal from '@/components/AddAccountModal'

interface Account {
  id: string
  username: string
  accountName: string | null
  gender: string | null
  status: string
  purpose: string | null
  lastPostAt: string | null
  characterDescription: string | null
  behavior: string | null
  speakingStyle: string | null
  expressionStyle: string | null
  movementStyle: string | null
  forbiddenRules: string | null
  postingMonitor: { status: string } | null
}

const PERSONA_KEYS = ['characterDescription', 'behavior', 'speakingStyle', 'expressionStyle', 'movementStyle', 'forbiddenRules'] as const

const MONITOR_BADGE: Record<string, { label: string; cls: string }> = {
  READY_UPLOAD: { label: 'siap posting', cls: 'bg-amber-100 text-amber-700' },
  HOT_VIDEO: { label: '🔥 panas', cls: 'bg-orange-100 text-orange-700' },
  STILL_GROWING: { label: '📈 tumbuh', cls: 'bg-cyan-100 text-cyan-700' },
  MONITORING: { label: 'monitoring', cls: 'bg-blue-100 text-blue-700' },
  NEED_NEW_VIDEO: { label: 'butuh konten', cls: 'bg-red-100 text-red-700' },
  WAITING: { label: 'menunggu', cls: 'bg-stone-100 text-stone-500' },
}

const AVATAR_TONES = [
  'from-violet-100 to-pink-100 text-violet-700',
  'from-blue-100 to-cyan-100 text-blue-700',
  'from-amber-100 to-orange-100 text-amber-700',
  'from-emerald-100 to-teal-100 text-emerald-700',
  'from-rose-100 to-fuchsia-100 text-rose-700',
]

function lastPostLabel(d: string | null): string {
  if (!d) return 'belum pernah post'
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
  if (days === 0) return 'post hari ini'
  if (days === 1) return 'post kemarin'
  return `post ${days} hari lalu`
}

export default function InfluencerRoster() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'ready' | 'incomplete'>('all')
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    fetch('/api/admin/accounts', { cache: 'no-store', credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setAccounts(d.accounts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const personaFilled = (a: Account) => PERSONA_KEYS.filter(k => !!a[k]).length

  const visible = accounts.filter(a => {
    if (filter === 'ready') return a.postingMonitor?.status === 'READY_UPLOAD'
    if (filter === 'incomplete') return personaFilled(a) < 6
    return true
  })

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-stone-400 text-sm">Loading roster...</div>
  }

  return (
    <div>
      {/* Filter strip */}
      <div className="flex items-center gap-2 mb-5">
        {([
          ['all', `Semua (${accounts.length})`],
          ['ready', `Siap posting (${accounts.filter(a => a.postingMonitor?.status === 'READY_UPLOAD').length})`],
          ['incomplete', `Persona belum lengkap (${accounts.filter(a => personaFilled(a) < 6).length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
              filter === key
                ? 'bg-violet-100 text-violet-700 border-violet-200'
                : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setShowAddModal(true)}
          className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-full hover:bg-violet-700 transition-colors"
        >
          ➕ Add Account
        </button>
        <Link href="/accounts" className="ml-auto text-xs font-semibold text-stone-400 hover:text-stone-600">
          tampilan tabel →
        </Link>
      </div>

      {/* Roster grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visible.map((a, i) => {
          const filled = personaFilled(a)
          const badge = a.postingMonitor ? MONITOR_BADGE[a.postingMonitor.status] : null
          return (
            <Link
              key={a.id}
              href={`/accounts/${a.id}`}
              className="bg-white rounded-2xl border border-stone-200 p-5 hover:border-violet-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${AVATAR_TONES[i % AVATAR_TONES.length]} flex items-center justify-center text-base font-extrabold shrink-0`}>
                  {a.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-extrabold text-stone-900 truncate group-hover:text-violet-700 transition-colors">
                      @{a.username}
                    </p>
                    {a.gender === 'F' && <span className="text-pink-500 text-xs">♀</span>}
                    {a.gender === 'M' && <span className="text-blue-500 text-xs">♂</span>}
                  </div>
                  {a.accountName && <p className="text-[11px] text-stone-400 truncate">{a.accountName}</p>}
                </div>
                {a.status !== 'active' && (
                  <span className="text-[9px] font-bold uppercase bg-stone-100 text-stone-400 px-1.5 py-0.5 rounded">off</span>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                {/* Persona completeness */}
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {PERSONA_KEYS.map(k => (
                      <span key={k} className={`w-1.5 h-1.5 rounded-sm ${a[k] ? 'bg-violet-500' : 'bg-stone-200'}`} />
                    ))}
                  </div>
                  <span className={`text-[10px] font-bold ${filled === 0 ? 'text-red-400' : filled < 6 ? 'text-amber-500' : 'text-violet-600'}`}>
                    {filled}/6
                  </span>
                </div>
                {badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                )}
              </div>

              <p className="mt-2.5 text-[11px] text-stone-400">{lastPostLabel(a.lastPostAt)}</p>
            </Link>
          )
        })}
      </div>

      {visible.length === 0 && (
        <p className="text-center py-12 text-sm text-stone-400">Tidak ada akun yang cocok dengan filter.</p>
      )}

      <AddAccountModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          fetch('/api/admin/accounts', { cache: 'no-store', credentials: 'include' })
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(d => setAccounts(d.accounts ?? []))
            .catch(() => {})
        }}
      />
    </div>
  )
}
