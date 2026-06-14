'use client'

import { useEffect, useState, useCallback } from 'react'

// ─── Types ──────────────────────────────────────────────
interface ApiKey {
  id: string; prefix: string; name: string; lastUsedAt: string | null; createdAt: string
}
interface Transaction {
  id: string; amount: number; reason: string; balanceAfter: number; createdAt: string
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

  const fetchAll = useCallback(async () => {
    try {
      const [kr, cr] = await Promise.all([
        fetch('/api/admin/connections/api-keys', { credentials: 'include' }),
        fetch('/api/admin/connections/credits', { credentials: 'include' }),
      ])
      if (kr.ok) { const d = await kr.json(); setKeys(d.apiKeys ?? []) }
      if (cr.ok) { const d = await cr.json(); setBalance(d.creditBalance); setTxs(d.recentTransactions ?? []) }
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

  const curlEx = `curl -X POST https://ai.boytenggara.com/api/gen/video \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "prompt": "A product demo of Glazingskin lotion on a wooden table",
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

      {/* Credit */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-stone-800 mb-3">💳 Credit Balance</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-violet-700">
            {balance !== null ? balance.toLocaleString() : '—'}
          </span>
          <span className="text-sm text-stone-500">credits</span>
        </div>
        {txs.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-stone-400 cursor-pointer">Recent transactions ({txs.length})</summary>
            <div className="mt-2 space-y-1">
              {txs.slice(0, 10).map(tx => (
                <div key={tx.id} className="flex justify-between text-xs py-1 px-2 bg-stone-50 rounded">
                  <span className="text-stone-600">{tx.reason} · {fmt(tx.createdAt)}</span>
                  <span className={`font-mono font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Generate Key */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
        <h3 className="text-base font-semibold text-stone-800">🔑 Generate API Key</h3>
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
                  className="btn-danger btn-sm">{revoking === k.id ? 'Revoking...' : 'Revoke'}</button>
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
          ['POST', '/api/gen/video', 'Generate video. Deduct credits.', [
            ['prompt', 'string', '✅'], ['orientation', 'portrait|landscape|square', '—'],
            ['resolution', 'SD|HD', '—'], ['durationSeconds', '6|10', '—'],
          ]],
          ['GET', '/api/gen/video/:id', 'Cek job status.', []],
          ['GET', '/api/gen/credits', 'Cek balance + transactions.', []],
          ['GET', '/api/gen/media?limit=20', 'List hasil generate.', []],
        ].map(([method, path, desc, fields]) => (
          <div key={path as string}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${
                method === 'POST' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
              }`}>{method}</span>
              <code className="text-sm font-mono text-stone-800">{path as string}</code>
            </div>
            <p className="text-sm text-stone-600 mb-1">{desc}</p>
            {(fields as any[]).length > 0 && (
              <table className="w-full text-xs mb-2">
                <thead><tr className="text-stone-400 uppercase"><th className="pb-1 pr-2 text-left font-medium">Field</th><th className="pb-1 pr-2 text-left font-medium">Type</th><th className="pb-1 text-left font-medium">Req</th></tr></thead>
                <tbody className="divide-y divide-stone-50">
                  {(fields as any[]).map((f: any) => (
                    <tr key={f[0]}><td className="py-1 pr-2 font-mono">{f[0]}</td><td className="py-1 pr-2 text-stone-500">{f[1]}</td><td className="py-1">{f[2]}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      {/* Curl example + Pricing */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-stone-800 mb-3">🚀 Curl Example</h3>
        <pre className="bg-stone-900 text-green-400 text-xs p-4 rounded-xl overflow-x-auto">{curlEx}</pre>
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
