'use client'

import { useState } from 'react'

interface HashResult {
  found: boolean
  type?: 'tx' | 'media'
  record?: any
  revoked?: boolean
}

export default function HashCheckerTab() {
  const [hash, setHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<HashResult | null>(null)
  const [error, setError] = useState('')

  const handleCheck = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const r = await fetch('/api/admin/hash-check', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: hash.trim() }),
      })
      const d = await r.json()
      if (r.ok) {
        setResult(d)
      } else {
        setError(d.error ?? 'Unknown error')
      }
    } catch {
      setError('Network error')
    }
    setLoading(false)
  }

  const fmt = (s: string) => new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-stone-800">Hash Checker</h2>
        <p className="text-sm text-stone-500 mt-0.5">
          Verify receipt hash dari CreditTransaction atau GeneratedMedia.
        </p>
      </div>

      {/* Input */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
        <div className="flex gap-3">
          <input
            type="text"
            value={hash}
            onChange={e => setHash(e.target.value)}
            placeholder="Paste 64-char hex hash..."
            className="border border-stone-300 rounded-xl px-3.5 py-2 text-sm font-mono flex-1"
            onKeyDown={e => e.key === 'Enter' && handleCheck()}
          />
          <button onClick={handleCheck} disabled={loading || hash.trim().length !== 64} className="btn-primary">
            {loading ? 'Checking...' : 'Check'}
          </button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>

      {/* Result */}
      {result && (
        <div className={`bg-white border rounded-2xl p-6 ${
          !result.found ? 'border-stone-200' :
          result.revoked ? 'border-red-200 bg-red-50' :
          'border-emerald-200 bg-emerald-50'
        }`}>
          {!result.found ? (
            <div className="text-sm text-stone-500">❌ Hash tidak ditemukan di database.</div>
          ) : result.revoked ? (
            <div className="text-sm text-red-700 font-semibold mb-3">🚫 Hash revoked — transaksi/media sudah dibatalkan.</div>
          ) : (
            <div className="text-sm text-emerald-700 font-semibold mb-3">✅ Hash valid — {result.type === 'tx' ? 'Credit Transaction' : 'Generated Media'}</div>
          )}

          {result.record && (
            <div className="space-y-2 text-sm">
              {result.type === 'tx' && (
                <>
                  <div><span className="text-stone-500">Type:</span> <span className="font-mono font-bold text-stone-700">CreditTransaction</span></div>
                  <div><span className="text-stone-500">User:</span> {result.record.user?.name ?? '—'} ({result.record.user?.email ?? '—'})</div>
                  <div><span className="text-stone-500">Amount:</span> <span className={`font-mono ${result.record.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>{result.record.amount > 0 ? '+' : ''}{result.record.amount?.toLocaleString()}</span></div>
                  <div><span className="text-stone-500">Reason:</span> {result.record.reason}</div>
                  <div><span className="text-stone-500">Balance After:</span> {result.record.balanceAfter?.toLocaleString()} credits</div>
                  <div><span className="text-stone-500">Date:</span> {fmt(result.record.createdAt)}</div>
                  {result.record.refId && <div><span className="text-stone-500">Ref:</span> <span className="font-mono text-xs">{result.record.refId}</span> ({result.record.refType})</div>}
                </>
              )}
              {result.type === 'media' && (
                <>
                  <div><span className="text-stone-500">Type:</span> <span className="font-mono font-bold text-stone-700">GeneratedMedia</span></div>
                  <div><span className="text-stone-500">User:</span> {result.record.user?.name ?? '—'} ({result.record.user?.email ?? '—'})</div>
                  <div><span className="text-stone-500">Status:</span> {result.record.status}</div>
                  <div><span className="text-stone-500">Prompt:</span> <span className="text-stone-600 italic">{result.record.prompt?.slice(0, 100)}{(result.record.prompt?.length ?? 0) > 100 ? '...' : ''}</span></div>
                  <div><span className="text-stone-500">Credits Cost:</span> {result.record.creditsCost?.toLocaleString()}</div>
                  <div><span className="text-stone-500">Completed:</span> {result.record.completedAt ? fmt(result.record.completedAt) : '—'}</div>
                  {result.record.videoUrl && <div><span className="text-stone-500">Video:</span> <a href={result.record.videoUrl} target="_blank" className="text-violet-600 underline text-xs break-all">{result.record.videoUrl}</a></div>}
                  {result.record.mediaHashRevokedAt && <div><span className="text-stone-500">Revoked:</span> <span className="text-red-600">{fmt(result.record.mediaHashRevokedAt)}</span></div>}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
