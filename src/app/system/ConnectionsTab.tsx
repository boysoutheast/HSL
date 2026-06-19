'use client'

import { useEffect, useState, useCallback } from 'react'
import { HelpHint } from '@/components/ui/HelpHint'

// ─── Types ──────────────────────────────────────────────
interface ApiKey {
  id: string; prefix: string; name: string; lastUsedAt: string | null; createdAt: string
}
interface Transaction {
  id: string; amount: number; reason: string; balanceAfter: number; createdAt: string; txHash?: string
}

interface HermesAgent {
  id: string; name: string; status: string; notes: string | null; createdAt: string
  _count?: { assignments: number; contentLogs: number }
}

// ─── Helpers ────────────────────────────────────────────
function fmt(s: string) {
  return new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ─── Component ──────────────────────────────────────────
export default function ConnectionsTab() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [balance, setBalance] = useState<number | null>(null)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [keyName, setKeyName] = useState('')
  const [newKey, setNewKey] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [showTxDetail, setShowTxDetail] = useState(false)

  // Hermes Agent Keys
  // ── Meta Connections ──
  interface MetaConnection {
    id: string; name: string; metaUserId: string | null; metaUserName: string | null
    status: string; tokenExpiry: string | null; lastTokenCheckAt: string | null
    lastMetaCallAt: string | null; createdAt: string
    adAccounts: { id: string; name: string }[]
  }
  const [metaConnections, setMetaConnections] = useState<MetaConnection[]>([])
  const [metaConnLoading, setMetaConnLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/connections/meta', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setMetaConnections(d?.connections ?? []); setMetaConnLoading(false) })
      .catch(() => setMetaConnLoading(false))
  }, [])

  function statusPill(status: string, expiry: string | null) {
    if (status === 'connected') return { label: 'Terhubung', cls: 'bg-emerald-100 text-emerald-700' }
    if (status === 'expiring_soon') return { label: `Segera expire (${Math.ceil((new Date(expiry!).getTime() - Date.now()) / 86400000)} hari)`, cls: 'bg-amber-100 text-amber-700' }
    if (status === 'needs_reconnect') return { label: 'Perlu reconnect', cls: 'bg-red-100 text-red-700' }
    if (status === 'expired') return { label: 'Expired', cls: 'bg-red-100 text-red-700' }
    if (status === 'revoked') return { label: 'Dicabut', cls: 'bg-stone-100 text-stone-500' }
    return { label: status, cls: 'bg-stone-100 text-stone-500' }
  }
  const [hermesAgents, setHermesAgents] = useState<HermesAgent[]>([])
  const [hermesAgentName, setHermesAgentName] = useState('')
  const [hermesAgentNotes, setHermesAgentNotes] = useState('')
  const [hermesCreating, setHermesCreating] = useState(false)
  const [hermesNewKey, setHermesNewKey] = useState<{name: string; key: string} | null>(null)
  const [hermesRegenLoading, setHermesRegenLoading] = useState<string | null>(null)
  const [hermesKeyCopied, setHermesKeyCopied] = useState(false)
  const [hermesError, setHermesError] = useState('')

  const fetchAll = useCallback(async () => {
    try {
      const [kr, cr, hr] = await Promise.all([
        fetch('/api/admin/connections/api-keys', { credentials: 'include' }),
        fetch('/api/admin/connections/credits', { credentials: 'include' }),
        fetch('/api/admin/hermes-agents', { credentials: 'include' }),
      ])
      if (kr.ok) { const d = await kr.json(); setKeys(d.apiKeys ?? []) }
      if (cr.ok) { const d = await cr.json(); setBalance(d.creditBalance); setTxs(d.recentTransactions ?? []) }
      if (hr.ok) { const d = await hr.json(); setHermesAgents(d.agents ?? []) }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleGenerate = async () => {
    setGenerating(true); setNewKey('')
    try {
      const r = await fetch('/api/admin/connections/api-keys', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName || 'Default' }),
      })
      const d = await r.json()
      if (r.ok && d.apiKey) { setNewKey(d.apiKey); setKeyName(''); await fetchAll() }
    } catch {}
    setGenerating(false)
  }

  const handleRevoke = async (id: string) => {
    setRevoking(id)
    try { await fetch(`/api/admin/connections/api-keys/${id}`, { method: 'DELETE', credentials: 'include' }); await fetchAll() }
    catch {}
    setRevoking(null)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(newKey)
    setCopied(true); setTimeout(() => setCopied(false), 3000)
  }

  const handleHermesCreate = async () => {
    if (!hermesAgentName.trim()) return
    setHermesCreating(true); setHermesError('')
    try {
      const r = await fetch('/api/admin/hermes-agents', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: hermesAgentName.trim(), notes: hermesAgentNotes.trim() || undefined }),
      })
      const d = await r.json()
      if (r.ok && d.apiKey) {
        setHermesNewKey({ name: d.agent.name, key: d.apiKey })
        setHermesAgentName('')
        setHermesAgentNotes('')
        setHermesKeyCopied(false)
        await fetchAll()
      } else {
        setHermesError(d.error || 'Gagal membuat agent')
      }
    } catch {
      setHermesError('Network error — coba lagi')
    }
    setHermesCreating(false)
  }

  const handleHermesRegen = async (agent: HermesAgent) => {
    if (!window.confirm(`Regenerate key untuk "${agent.name}"? Key lama langsung tidak berlaku.`)) return
    setHermesRegenLoading(agent.id); setHermesError('')
    try {
      const r = await fetch(`/api/admin/hermes-agents/${agent.id}/regenerate-key`, { method: 'POST', credentials: 'include' })
      const d = await r.json()
      if (r.ok) { setHermesNewKey({ name: agent.name, key: d.apiKey }); setHermesKeyCopied(false) }
      else { setHermesError(d.error || 'Gagal regenerate key') }
    } catch { setHermesError('Network error — coba lagi') }
    setHermesRegenLoading(null)
  }

  const handleHermesToggle = async (agent: HermesAgent) => {
    const newStatus = agent.status === 'active' ? 'inactive' : 'active'
    try {
      await fetch(`/api/admin/hermes-agents/${agent.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      setHermesAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: newStatus } : a))
    } catch {}
  }

  const handleHermesCopy = async () => {
    if (!hermesNewKey) return
    await navigator.clipboard.writeText(hermesNewKey.key)
    setHermesKeyCopied(true); setTimeout(() => setHermesKeyCopied(false), 3000)
  }

  const curlEx = `curl -X POST https://ai.boytenggara.com/api/gen/video \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "prompt": "A product demo on a clean table, soft lighting, 10 seconds",
    "orientation": "portrait",
    "resolution": "SD",
    "durationSeconds": 10
  }'`

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-stone-800">Connections</h2>
        <p className="text-sm text-stone-500 mt-0.5">
          API key management & credit untuk <code className="text-xs bg-stone-100 px-1 rounded">/api/gen/*</code> endpoints.
        </p>
      </div>

      {/* Hermes Agent Keys */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-stone-800">🤖 Hermes Agent Keys</h3>
          <p className="text-sm text-stone-500 mt-0.5">Bearer token untuk Hermes AI agents akses <code className="text-xs bg-stone-100 px-1 rounded">/api/hermes/*</code> endpoints.</p>
        </div>

        {/* New Key Alert */}
        {hermesNewKey && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
            <div className="text-sm font-semibold text-emerald-800">✅ Key baru untuk <span className="font-bold">{hermesNewKey.name}</span> — simpan sekarang!</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border border-emerald-300 rounded-lg px-3 py-2 text-sm font-mono text-emerald-900 break-all">{hermesNewKey.key}</code>
              <button onClick={handleHermesCopy} className="btn-outline btn-sm whitespace-nowrap">{hermesKeyCopied ? 'Copied!' : 'Copy'}</button>
            </div>
            <p className="text-xs text-emerald-700">⚠️ Simpan key ini sekarang — tidak akan ditampilkan lagi.</p>
          </div>
        )}

        {/* Create Form */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
            <input type="text" value={hermesAgentName} onChange={e => setHermesAgentName(e.target.value)}
              placeholder="Agent name (required)"
              className="border border-stone-300 rounded-xl px-3.5 py-2 text-sm flex-1" />
            <input type="text" value={hermesAgentNotes} onChange={e => setHermesAgentNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="border border-stone-300 rounded-xl px-3.5 py-2 text-sm w-48" />
            <button onClick={handleHermesCreate} disabled={hermesCreating || !hermesAgentName.trim()} className="btn-primary whitespace-nowrap">
              {hermesCreating ? 'Creating...' : 'Create Agent'}
            </button>
          </div>
          {hermesError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {hermesError}
            </div>
          )}
        </div>

        {/* Agent List */}
        {hermesAgents.length > 0 && (
          <div className="border-t border-stone-100 pt-4 mt-2">
            <div className="text-xs font-semibold text-stone-400 uppercase mb-2">Agents ({hermesAgents.length})</div>
            <div className="divide-y divide-stone-100">
              {hermesAgents.map(agent => (
                <div key={agent.id} className="py-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-800 text-sm">{agent.name}</span>
                      <span className={`px-1.5 py-0.5 text-[11px] font-semibold rounded-full ${
                        agent.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
                      }`}>{agent.status}</span>
                    </div>
                    {agent.notes && (
                      <div className="text-xs text-stone-400 mt-0.5 truncate">{agent.notes}</div>
                    )}
                    <div className="text-xs text-stone-400 mt-0.5">
                      Created {fmt(agent.createdAt)}
                      {agent._count !== undefined ? ` · ${agent._count?.assignments ?? 0} assignments, ${agent._count?.contentLogs ?? 0} logs` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button onClick={() => handleHermesRegen(agent)} disabled={hermesRegenLoading === agent.id}
                      className="text-xs text-violet-600 hover:text-violet-800 underline whitespace-nowrap">
                      {hermesRegenLoading === agent.id ? 'Regenerating...' : 'Regen Key'}
                    </button>
                    <button onClick={() => handleHermesToggle(agent)}
                      className={`btn-sm text-xs whitespace-nowrap ${
                        agent.status === 'active' ? 'btn-ghost text-red-600' : 'btn-outline text-stone-600'
                      }`}>
                      {agent.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Meta Connections */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
        <h3 className="text-base font-semibold text-stone-800">🔗 Meta Connections</h3>
        <p className="text-sm text-stone-500">Akun Meta yang terhubung untuk automation campaign.</p>
        {metaConnLoading ? (
          <div className="text-sm text-stone-400 py-2">Loading...</div>
        ) : metaConnections.length === 0 ? (
          <div className="text-sm text-stone-400 py-2">Belum ada akun Meta terhubung.</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {metaConnections.map(c => {
              const pill = statusPill(c.status, c.tokenExpiry)
              return (
                <div key={c.id} className="py-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-800 text-sm">{c.name}</span>
                      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${pill.cls}`}>{pill.label}</span>
                    </div>
                    <div className="text-xs text-stone-400 mt-0.5">
                      {c.metaUserName && <span>{c.metaUserName} · </span>}
                      {c.adAccounts.map(a => `${a.name} (${a.id})`).join(', ')}
                    </div>
                    {c.lastMetaCallAt && (
                      <div className="text-xs text-stone-400">Terakhir dipakai: {new Date(c.lastMetaCallAt).toLocaleString('id-ID')}</div>
                    )}
                  </div>
                  {(c.status === 'needs_reconnect' || c.status === 'expired') && (
                    <a href="/api/admin/meta-oauth/start"
                      className="text-xs font-medium text-violet-600 hover:text-violet-800 underline whitespace-nowrap ml-4">
                      Hubungkan Ulang
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Credit */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-stone-800 mb-3">💳 Credit Balance</h3>
        <div
          className="flex items-baseline gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowTxDetail(!showTxDetail)}
        >
          <span className="text-3xl font-bold text-violet-700">
            {balance !== null ? balance.toLocaleString() : '—'}
          </span>
          <span className="text-sm text-stone-500">credits</span>
          <span className="text-xs text-stone-400 ml-1">{showTxDetail ? '▲' : '▼'}</span>
        </div>
        {showTxDetail && txs.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="text-xs text-stone-400 font-semibold mb-2">Recent Transactions</div>
            {txs.slice(0, 10).map(tx => (
              <div key={tx.id} className="flex flex-col py-1.5 px-2 bg-stone-50 rounded text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-600">{tx.reason} · {fmt(tx.createdAt)}</span>
                  <span className={`font-mono font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-stone-400">Balance: {tx.balanceAfter.toLocaleString()}</span>
                  {tx.txHash && (
                    <button
                      onClick={async (e) => { e.stopPropagation(); await navigator.clipboard.writeText(tx.txHash!) }}
                      className="text-violet-500 hover:text-violet-700 font-mono text-[10px]"
                      title={tx.txHash}
                    >
                      {tx.txHash.slice(0, 12)}...
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate Key */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
        <h3 className="text-base font-semibold text-stone-800">🔑 Generate API Key <HelpHint k="cn.apiKey" /></h3>
        <div className="flex gap-3">
          <input type="text" value={keyName} onChange={e => setKeyName(e.target.value)}
            placeholder="Key name (optional)"
            className="border border-stone-300 rounded-xl px-3.5 py-2 text-sm flex-1" />
          <button onClick={handleGenerate} disabled={generating} className="btn-primary">
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
        {newKey && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
            <div className="text-sm font-semibold text-emerald-800">✅ Simpan key ini sekarang!</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border border-emerald-300 rounded-lg px-3 py-2 text-sm font-mono text-emerald-900 break-all">{newKey}</code>
              <button onClick={handleCopy} className="btn-outline btn-sm whitespace-nowrap">{copied ? 'Copied!' : 'Copy'}</button>
            </div>
          </div>
        )}
      </div>

      {/* Active Keys */}
      {keys.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl">
          <div className="p-4 border-b border-stone-100">
            <h3 className="text-base font-semibold text-stone-800">Active Keys ({keys.length})</h3>
          </div>
          <div className="divide-y divide-stone-100">
            {keys.map(k => (
              <div key={k.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-800 text-sm">{k.name}</span>
                    <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded text-stone-500 font-mono">{k.prefix}...</code>
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5">
                    Created {fmt(k.createdAt)}
                    {k.lastUsedAt ? ` · Last used ${fmt(k.lastUsedAt)}` : ' · Never used'}
                  </div>
                </div>
                <button onClick={() => handleRevoke(k.id)} disabled={revoking === k.id}
                  className="btn-danger btn-sm">{revoking === k.id ? 'Revoking...' : 'Revoke'} <HelpHint k="cn.revoke" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No keys state */}
      {!loading && keys.length === 0 && (
        <div className="text-sm text-stone-400 text-center py-4">No API keys yet. Generate one above.</div>
      )}

      {/* Docs */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-6">
        <h3 className="text-base font-semibold text-stone-800">📡 API Gen Endpoints</h3>

        {[
          ['POST', '/api/gen/video', 'Submit video generation. Wajib multipart/form-data. Deducts credits.', [
            ['prompt', 'string', '✅', 'Deskripsi video (Bahasa Indonesia OK). Max 2000 char.'],
            ['file', 'binary', '✅', 'Foto referensi (JPEG/PNG/WebP, max 10MB)'],
            ['clientRef', 'string', '—', 'Referensi unik per slot (e.g. "ad-3-rahasia-123"). Max 200 char. Dikembalikan di semua poll response. Pakai ini untuk parallel job tracking.'],
            ['orientation', 'portrait|landscape', '—', 'Default: portrait'],
            ['resolution', 'SD|HD', '—', 'Default: SD'],
            ['durationSeconds', '6|10', '—', 'Default: 10'],
          ], [
            ['id', 'string', 'AI Buddy job ID — simpan untuk polling'],
            ['creditsCost', 'number', 'Credits terpotong'],
            ['balanceAfter', 'number', 'Sisa credits'],
          ]],
          ['GET', '/api/gen/video/:id', 'Poll status job spesifik.', [], [
            ['id', 'string', 'AI Buddy job ID'],
            ['clientRef', 'string|null', 'Referensi caller — sama persis dengan yang di-set saat submit'],
            ['status', 'string', 'queued → processing → completed | failed | stalled'],
            ['videoUrl', 'string|null', 'URL video (null sebelum completed)'],
            ['thumbnailUrl', 'string|null', 'URL thumbnail'],
            ['creditsCost', 'number|null', 'Credits yang dipotong'],
            ['refundedAt', 'string|null', 'Non-null = credits sudah dikembalikan (failed/timeout)'],
            ['errorMessage', 'string|null', 'Error detail jika failed'],
            ['completedAt', 'string|null', 'ISO timestamp saat completed'],
          ]],
          ['GET', '/api/gen/video', 'List semua job. Filter by clientRef untuk parallel tracking.', [
            ['clientRef', 'string', '—', 'Filter by clientRef (query param)'],
            ['limit', 'number', '—', 'Default 20, max 100'],
            ['offset', 'number', '—', 'Untuk pagination'],
          ], [
            ['items', 'array', 'Array job — tiap item include clientRef, status, videoUrl, refundedAt'],
            ['total', 'number', 'Total job (untuk pagination)'],
          ]],
          ['GET', '/api/gen/credits', 'Cek balance + history transaksi.', [], []],
        ].map(([method, path, desc, reqFields, respFields]: any) => (
          <div key={path as string}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${
                method === 'POST' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
              }`}>{method}</span>
              <code className="text-sm font-mono text-stone-800">{path as string}</code>
            </div>
            <p className="text-sm text-stone-600 mb-2">{desc}</p>
            {reqFields.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-stone-400 font-semibold mb-1">Request Body:</div>
                <table className="w-full text-xs">
                  <thead><tr className="text-stone-400 uppercase"><th className="pb-1 pr-2 text-left font-medium">Field</th><th className="pb-1 pr-2 text-left font-medium">Type</th><th className="pb-1 pr-2 text-left font-medium">Req</th><th className="pb-1 text-left font-medium">Notes</th></tr></thead>
                  <tbody className="divide-y divide-stone-50">
                    {reqFields.map((f: any) => (
                      <tr key={f[0]}><td className="py-1 pr-2 font-mono">{f[0]}</td><td className="py-1 pr-2 text-stone-500">{f[1]}</td><td className="py-1 pr-2">{f[2]}</td><td className="py-1 text-stone-500 text-[11px]">{f[3]}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {respFields.length > 0 && (
              <div>
                <div className="text-xs text-stone-400 font-semibold mb-1">Response:</div>
                <table className="w-full text-xs">
                  <thead><tr className="text-stone-400 uppercase"><th className="pb-1 pr-2 text-left font-medium">Field</th><th className="pb-1 pr-2 text-left font-medium">Type</th><th className="pb-1 text-left font-medium">Notes</th></tr></thead>
                  <tbody className="divide-y divide-stone-50">
                    {respFields.map((f: any) => (
                      <tr key={f[0]}><td className="py-1 pr-2 font-mono">{f[0]}</td><td className="py-1 pr-2 text-stone-500">{f[1]}</td><td className="py-1 text-stone-500 text-[11px]">{f[2]}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Flow & Timing */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
        <h3 className="text-base font-semibold text-stone-800">⏱ Flow & Timing</h3>

        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-stone-500 uppercase mb-2">Normal Flow (1–25 menit — tergantung antrian GeminiGen)</div>
            <pre className="bg-stone-50 border border-stone-200 text-xs text-stone-700 p-3 rounded-xl overflow-x-auto whitespace-pre-wrap">{`POST /api/gen/video → 201 { id, creditsCost, balanceAfter }
  ↓ (simpan id)
Poll GET /api/gen/video/{id} setiap 30s
  status: queued → processing → completed | stalled | failed
  ↓ completed
Download videoUrl`}</pre>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <div className="text-xs font-semibold text-emerald-700 mb-1">Best Case (~40s)</div>
              <div className="text-xs text-emerald-800">Submit → GeminiGen webhook masuk → langsung completed</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="text-xs font-semibold text-amber-700 mb-1">Worst Case (~25+ menit)</div>
              <div className="text-xs text-amber-800">Submit → GeminiGen lambat → job <code className="bg-amber-100 px-0.5 rounded">stalled</code> → cek lagi nanti. <strong>Tidak auto-refund</strong> — video mungkin masih jadi.</div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-stone-500 uppercase mb-2">Status Lifecycle</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-stone-400 uppercase border-b border-stone-100">
                <th className="pb-2 pr-3 text-left font-medium">Status</th>
                <th className="pb-2 pr-3 text-left font-medium">Artinya</th>
                <th className="pb-2 text-left font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              <tr><td className="py-1.5 pr-3 font-mono text-stone-700">queued</td><td className="py-1.5 pr-3 text-stone-600">Job diterima</td><td className="py-1.5 text-stone-500">Tunggu</td></tr>
              <tr><td className="py-1.5 pr-3 font-mono text-stone-700">processing</td><td className="py-1.5 pr-3 text-stone-600">Di GeminiGen</td><td className="py-1.5 text-stone-500">Poll tiap 30s</td></tr>
              <tr><td className="py-1.5 pr-3 font-mono text-emerald-700">completed</td><td className="py-1.5 pr-3 text-stone-600">Siap</td><td className="py-1.5 text-stone-500">Download <code className="bg-stone-100 px-0.5 rounded">videoUrl</code></td></tr>
              <tr><td className="py-1.5 pr-3 font-mono text-red-600">failed</td><td className="py-1.5 pr-3 text-stone-600">GeminiGen gagal (status=3)</td><td className="py-1.5 text-stone-500">Cek <code className="bg-stone-100 px-0.5 rounded">refundedAt</code> → resubmit</td></tr>
              <tr><td className="py-1.5 pr-3 font-mono text-amber-600">stalled</td><td className="py-1.5 pr-3 text-stone-600">Melebihi 30 menit, masih proses di GeminiGen</td><td className="py-1.5 text-stone-500">Tunggu atau laporkan — tdk auto-refund</td></tr>
            </tbody>
          </table>
        </div>

        <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
          <div className="text-xs font-semibold text-stone-600 mb-1">Polling Recommendation</div>
          <ul className="text-xs text-stone-500 space-y-0.5 list-disc list-inside">
            <li>Interval: 30 detik</li>
            <li>Timeout client: berhenti setelah 30 menit</li>
            <li>Status <code className="bg-stone-100 px-0.5 rounded">stalled</code> = bukan failed — video mungkin masih jadi di GeminiGen</li>
            <li>Cek <code className="bg-stone-100 px-0.5 rounded">refundedAt</code> saat status=failed — kalau non-null, aman resubmit</li>
          </ul>
        </div>
      </div>

      {/* Refund Policy */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-stone-800">🔄 Refund Policy</h3>
        <ul className="text-sm text-stone-600 space-y-2">
          <li className="flex gap-2"><span className="text-stone-400 mt-0.5">•</span><span>Refund otomatis saat: GeminiGen failed (status=3) ATAU job never submitted</span></li>
          <li className="flex gap-2"><span className="text-stone-400 mt-0.5">•</span><span>Cek <code className="text-xs bg-stone-100 px-1 rounded">refundedAt</code> di response — non-null = credits sudah kembali</span></li>
          <li className="flex gap-2"><span className="text-stone-400 mt-0.5">•</span><span>Idempotent — tidak bisa double refund</span></li>
          <li className="flex gap-2"><span className="text-stone-400 mt-0.5">•</span><span>Cek balance via <code className="text-xs bg-stone-100 px-1 rounded">GET /api/gen/credits</code> setelah refund</span></li>
        </ul>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="text-xs font-semibold text-blue-700 mb-1">Webhook</div>
          <div className="text-xs text-blue-800">
            <code className="bg-blue-100 px-1 rounded">https://ai.boytenggara.com/api/webhooks/geminigen</code>
          </div>
          <div className="text-xs text-blue-700 mt-1.5">Kalau aktif → video selesai ~40s. Kalau tidak → cron backup tiap 5 menit.</div>
        </div>
      </div>

      {/* Error Codes */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-stone-800 mb-3">⚠️ Error Codes</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-stone-400 uppercase border-b border-stone-100"><th className="pb-2 pr-2 text-left">Status</th><th className="pb-2 text-left">Meaning</th></tr></thead>
          <tbody>
            <tr className="border-b border-stone-50"><td className="py-2 pr-2 font-mono text-xs font-bold text-red-600">400</td><td className="py-2 text-xs">Bad request — prompt kosong, invalid JSON</td></tr>
            <tr className="border-b border-stone-50"><td className="py-2 pr-2 font-mono text-xs font-bold text-red-600">401</td><td className="py-2 text-xs">Invalid or missing API key</td></tr>
            <tr><td className="py-2 pr-2 font-mono text-xs font-bold text-red-600">402</td><td className="py-2 text-xs">Insufficient credits — balance & required credits returned in body</td></tr>
          </tbody>
        </table>
      </div>

      {/* Curl example + Polling */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-stone-800 mb-3">🚀 Generate Example</h3>
          <pre className="bg-stone-900 text-green-400 text-xs p-4 rounded-xl overflow-x-auto">{curlEx}</pre>
        </div>
        <div>
          <h3 className="text-base font-semibold text-stone-800 mb-3">🔄 Polling Example</h3>
          <pre className="bg-stone-900 text-green-400 text-xs p-4 rounded-xl overflow-x-auto">{`# Poll sampai video selesai (max 5 menit)
JOB_ID="abc123"
while true; do
  STATUS=$(curl -s https://ai.boytenggara.com/api/gen/video/$JOB_ID \\
    -H "x-api-key: YOUR_API_KEY" | jq -r '.status')
  if [ "$STATUS" = "completed" ]; then
    curl -s https://ai.boytenggara.com/api/gen/video/$JOB_ID \\
      -H "x-api-key: YOUR_API_KEY" | jq '.videoUrl'
    break
  fi
  sleep 5
done`}</pre>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-stone-800 mb-3">💰 Pricing</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-stone-400 uppercase border-b border-stone-100"><th className="pb-2 pr-2 text-left">Duration</th><th className="pb-2 pr-2 text-left">SD</th><th className="pb-2 text-left">HD</th></tr></thead>
          <tbody>
            <tr className="border-b border-stone-50"><td className="py-2 pr-2 font-mono text-xs">6s</td><td className="py-2 pr-2 text-xs">1,000 cr</td><td className="py-2 text-xs">2,000 cr</td></tr>
            <tr><td className="py-2 pr-2 font-mono text-xs">10s</td><td className="py-2 pr-2 text-xs">1,300 cr</td><td className="py-2 text-xs">2,600 cr</td></tr>
          </tbody>
        </table>
      </div>

      {/* Auth note */}
      <div className="text-xs text-stone-400 text-center">
        Auth via <code className="bg-stone-100 px-1 rounded">x-api-key</code> or <code className="bg-stone-100 px-1 rounded">Authorization: Bearer</code> header.
        Keys are scoped to your account — get yours in the <a href="/studio" className="text-violet-600 underline">Media Studio</a>.
      </div>
    </div>
  )
}
