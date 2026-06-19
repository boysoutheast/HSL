'use client'

import { useEffect, useState } from 'react'

interface OverviewData {
  users: { total: number; active: number; pending: number; suspended: number }
  credits: { outstanding: number; consumed30d: number; granted30d: number }
  videos: { total30d: number; succeeded30d: number; failed30d: number; successRate: number }
  campaigns: { running: number; total: number }
  spend30d: number
  alerts: { pendingApprovals: number; zeroBalanceUsers: number }
  recentActivity: Array<{ type: string; userEmail: string; detail: string; at: string }>
}

function fmtRp(n: number): string {
  if (n >= 1_000_000) return 'Rp' + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'jt'
  if (n >= 1_000) return 'Rp' + (n / 1_000).toFixed(0) + 'rb'
  return 'Rp' + n.toLocaleString()
}

function fmtNum(n: number): string { return n.toLocaleString() }

export default function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = () => {
      fetch('/api/admin/overview', { credentials: 'include' })
        .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error) }))
        .then(setData)
        .catch(e => setError(e.message))
    }
    load()
    const interval = setInterval(load, 60_000) // poll 60s
    return () => clearInterval(interval)
  }, [])

  if (error) return <div className="text-sm text-red-500 p-6">Gagal muat data: {error}</div>
  if (!data) return <div className="text-sm text-stone-400 p-6">Loading overview...</div>

  const kpiCards = [
    { icon: '👥', label: 'Users', value: fmtNum(data.users.total), sub: `${data.users.pending} pending` },
    { icon: '💰', label: 'Saldo beredar', value: fmtRp(data.credits.outstanding), sub: '' },
    { icon: '🔥', label: 'Kredit kepakai 30h', value: fmtNum(data.credits.consumed30d), sub: 'kredit' },
    { icon: '🎬', label: 'Video 30h', value: fmtNum(data.videos.total30d), sub: `${data.videos.successRate}% ok` },
    { icon: '🚀', label: 'Campaign jalan', value: fmtNum(data.campaigns.running), sub: `${data.campaigns.total} total` },
    { icon: '📊', label: 'Spend Meta 30h', value: fmtRp(data.spend30d), sub: '' },
  ]

  return (
    <div className="p-2 space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {kpiCards.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="text-lg mb-1">{k.icon}</div>
            <div className="text-xs text-stone-500 mb-0.5">{k.label}</div>
            <div className="text-xl font-bold text-stone-900">{k.value}</div>
            {k.sub && <div className="text-xs text-stone-400 mt-0.5">{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Alerts */}
      {(data.alerts.pendingApprovals > 0 || data.alerts.zeroBalanceUsers > 0 || (data.alerts as any).needsReconnect > 0 || (data.alerts as any).expiringSoon > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-bold text-amber-800">⚠️ Perlu tindakan</h3>
          {data.alerts.pendingApprovals > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-amber-700">{data.alerts.pendingApprovals} user nunggu approve</span>
              <button onClick={() => { try { sessionStorage.setItem('hsl_systemTab', 'users'); window.dispatchEvent(new CustomEvent('hsl_system_tab', { detail: 'users' })) } catch {} }}
                className="text-xs font-medium text-amber-700 underline">Lihat</button>
            </div>
          )}
          {data.alerts.zeroBalanceUsers > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-amber-700">{data.alerts.zeroBalanceUsers} user saldo 0</span>
            </div>
          )}
          {(data.alerts as any).needsReconnect > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-red-700">{(data.alerts as any).needsReconnect} akun Meta perlu reconnect</span>
              <button onClick={() => window.dispatchEvent(new CustomEvent('hsl_system_tab', { detail: 'connections' }))}
                className="text-xs font-medium text-red-700 underline">Lihat</button>
            </div>
          )}
          {(data.alerts as any).expiringSoon > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-amber-700">{(data.alerts as any).expiringSoon} token Meta akan expire</span>
              <button onClick={() => window.dispatchEvent(new CustomEvent('hsl_system_tab', { detail: 'connections' }))}
                className="text-xs font-medium text-amber-700 underline">Lihat</button>
            </div>
          )}
        </div>
      )}

      {/* Activity Feed */}
      <div>
        <h3 className="text-sm font-bold text-stone-900 mb-3">Aktivitas terbaru</h3>
        <div className="space-y-1">
          {data.recentActivity.length === 0 && <div className="text-xs text-stone-400">Belum ada aktivitas 30 hari terakhir</div>}
          {data.recentActivity.slice(0, 20).map((a, i) => {
            const icons: Record<string, string> = { signup: '🆕', big_spend: '🔥', gen_failed: '⚠️', new_campaign: '🚀' }
            const time = new Date(a.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            return (
              <div key={i} className="flex gap-3 py-1.5 border-b border-stone-50 last:border-0 text-xs">
                <span>{icons[a.type] ?? '📌'}</span>
                <span className="text-stone-600">{time}</span>
                <span className="text-stone-800 font-medium">{a.userEmail}</span>
                <span className="text-stone-500">{a.detail}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
