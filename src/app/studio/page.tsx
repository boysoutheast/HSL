'use client'

import { useState, useEffect, useCallback } from 'react'

interface Transaction {
  id: string
  amount: number
  reason: string
  refId: string | null
  refType: string | null
  balanceAfter: number
  createdAt: string
}

interface GeneratedMedia {
  id: string
  status: string
  prompt: string
  mediaType: string
  creditsCost: number | null
  videoUrl: string | null
  thumbnailUrl: string | null
  durationSeconds: number
  orientation?: string
  resolution?: string
  errorMessage: string | null
  refundedAt: string | null
  createdAt: string
  completedAt: string | null
}

const ORIENTATIONS = [
  { id: 'portrait', label: '📱 Portrait (9:16)', w: 1080, h: 1920 },
  { id: 'landscape', label: '🖥️ Landscape (16:9)', w: 1920, h: 1080 },
  { id: 'square', label: '⬛ Square (1:1)', w: 1080, h: 1080 },
  { id: 'vertical', label: '📐 Vertical (4:5)', w: 1080, h: 1350 },
  { id: 'wide', label: '🎬 Wide (21:9)', w: 1920, h: 822 },
]

const DURATIONS = [6, 10] as const
const RESOLUTIONS = ['SD', 'HD'] as const

function getCost(res: string, dur: number): number {
  const base = dur <= 6 ? 1000 : 1300
  const mult = res === 'HD' ? 2 : 1
  return base * mult
}

export default function StudioPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [history, setHistory] = useState<GeneratedMedia[]>([])
  const [prompt, setPrompt] = useState('')
  const [orientation, setOrientation] = useState('portrait')
  const [resolution, setResolution] = useState<'SD' | 'HD'>('SD')
  const [duration, setDuration] = useState<number>(10)
  const [photoRefs, setPhotoRefs] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const cost = getCost(resolution, duration)
  const canAfford = balance !== null && balance >= cost

  const fetchState = useCallback(async () => {
    if (!apiKey) return
    try {
      const [credRes, genRes] = await Promise.all([
        fetch('/api/hermes/credits', { headers: { authorization: `Bearer ${apiKey}` } }),
        fetch('/api/hermes/generated-media?limit=20', { headers: { authorization: `Bearer ${apiKey}` } }),
      ])
      if (credRes.ok) {
        const data = await credRes.json()
        setBalance(data.balance)
        setTransactions(data.transactions ?? [])
      }
      if (genRes.ok) {
        const data = await genRes.json()
        setHistory(data.media ?? data.generatedMedia ?? data.transactions ?? data ?? [])
      }
    } catch {
      // ignore
    }
  }, [apiKey])

  useEffect(() => {
    if (apiKey) {
      fetchState()
      const interval = setInterval(fetchState, 12000)
      return () => clearInterval(interval)
    }
  }, [apiKey, fetchState])

  const handleGenerate = async () => {
    if (!apiKey || !prompt.trim()) return
    if (!canAfford) {
      setError(`Insufficient credits: need ${cost.toLocaleString()}, have ${balance?.toLocaleString() ?? 0}`)
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/hermes/generate/video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          orientation,
          resolution,
          durationSeconds: duration,
          photoReferenceIds: photoRefs
            .split(/\s+/)
            .filter(s => s.startsWith('@') && s.length > 1)
            .map(s => s.slice(1)),
        }),
      })
      const data = await res.json()
      if (res.status === 402) {
        setError(`Insufficient credits: balance ${data.balance?.toLocaleString()}, required ${data.required?.toLocaleString()}`)
      } else if (res.status === 403) {
        setError('No billing owner — contact admin')
      } else if (!res.ok) {
        setError(data.error ?? 'Generation failed')
      } else {
        setPrompt('')
        setPhotoRefs('')
        setError(null)
        await fetchState()
      }
    } catch {
      setError('Network error')
    } finally {
      setGenerating(false)
    }
  }

  const statusIcon = (s: string) => {
    switch (s) {
      case 'completed': return '✅'
      case 'queued': return '⏳'
      case 'processing': return '🔄'
      case 'failed': return '❌'
      default: return '⏳'
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>🎬 Media Studio</h1>

      {/* API Key Input */}
      <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
          API Key (hs_...)
        </label>
        <input
          type="password"
          value={apiKey ?? ''}
          onChange={e => setApiKey(e.target.value || null)}
          placeholder="Paste your API key here"
          style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }}
        />
      </div>

      {/* Balance */}
      {apiKey && (
        <div style={{ marginBottom: 24, padding: 16, background: canAfford ? '#f0fdf4' : '#fef2f2', borderRadius: 8, border: `1px solid ${canAfford ? '#bbf7d0' : '#fecaca'}` }}>
          <div style={{ fontSize: 13, color: '#666' }}>Credit Balance</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: canAfford ? '#166534' : '#dc2626' }}>
            {balance !== null ? balance.toLocaleString() : '—'}
          </div>
        </div>
      )}

      {/* Generate Form */}
      {apiKey && (
        <div style={{ marginBottom: 32 }}>
          {/* Orientation */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Orientation</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ORIENTATIONS.map(o => (
                <button
                  key={o.id}
                  onClick={() => setOrientation(o.id)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    border: `1.5px solid ${orientation === o.id ? '#7c3aed' : '#e5e7eb'}`,
                    borderRadius: 6,
                    background: orientation === o.id ? '#f5f3ff' : '#fff',
                    color: orientation === o.id ? '#6d28d9' : '#666',
                    cursor: 'pointer',
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution + Duration */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Resolution</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {RESOLUTIONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setResolution(r)}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: resolution === r ? 700 : 500,
                      border: `1.5px solid ${resolution === r ? '#7c3aed' : '#e5e7eb'}`,
                      borderRadius: 6,
                      background: resolution === r ? '#f5f3ff' : '#fff',
                      color: resolution === r ? '#6d28d9' : '#666',
                      cursor: 'pointer',
                    }}
                  >
                    {r === 'HD' ? '🔮 HD' : '📺 SD'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Duration</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {DURATIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: duration === d ? 700 : 500,
                      border: `1.5px solid ${duration === d ? '#7c3aed' : '#e5e7eb'}`,
                      borderRadius: 6,
                      background: duration === d ? '#f5f3ff' : '#fff',
                      color: duration === d ? '#6d28d9' : '#666',
                      cursor: 'pointer',
                    }}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cost Preview */}
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#faf5ff', borderRadius: 6, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#7c3aed', fontWeight: 600 }}>
              Cost: {cost.toLocaleString()} credits
            </span>
            {resolution === 'HD' && <span style={{ color: '#a78bfa', fontSize: 11 }}>HD = 2× SD</span>}
          </div>

          {/* Prompt */}
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe the video you want to generate..."
            rows={3}
            style={{ width: '100%', padding: 12, fontSize: 14, border: '1px solid #ddd', borderRadius: 8, resize: 'vertical', marginBottom: 8 }}
          />

          {/* Photo Reference Input */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>
              Photo References (optional, space-separated IDs: @id1 @id2)
            </label>
            <input
              type="text"
              value={photoRefs}
              onChange={e => setPhotoRefs(e.target.value)}
              placeholder="@abc123 @def456"
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6 }}
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim() || !canAfford}
            style={{
              marginTop: 8,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              background: generating || !canAfford ? '#d4d4d4' : '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: generating || !canAfford ? 'not-allowed' : 'pointer',
              width: '100%',
            }}
          >
            {!canAfford && balance !== null
              ? `Insufficient credits (need ${cost.toLocaleString()})`
              : generating
              ? 'Generating...'
              : `Generate Video — ${cost.toLocaleString()} credits`}
          </button>

          {error && (
            <div style={{ marginTop: 8, padding: 8, background: '#fef2f2', color: '#dc2626', borderRadius: 6, fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {apiKey && history.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>📹 Recent Generations</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.slice(0, 10).map(gen => (
              <div key={gen.id} style={{ padding: '10px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {statusIcon(gen.status)} {gen.status}
                  </span>
                  <span style={{ fontSize: 12, color: '#999' }}>
                    {gen.orientation ?? 'portrait'} · {gen.resolution ?? 'SD'} · {gen.durationSeconds}s · {gen.creditsCost ?? '—'}cr
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {gen.prompt}
                </div>
                {gen.errorMessage && (
                  <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{gen.errorMessage}</div>
                )}
                {gen.videoUrl && (
                  <a href={gen.videoUrl} target="_blank" rel="noopener" style={{ fontSize: 12, color: '#7c3aed', marginTop: 4, display: 'inline-block' }}>
                    Watch video →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions */}
      {apiKey && transactions.length > 0 && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>💰 Transaction History</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {transactions.slice(0, 20).map(tx => (
              <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#fafafa', borderRadius: 6, fontSize: 13 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{tx.reason.replace(/_/g, ' ')}</span>
                  <div style={{ color: '#999', fontSize: 11 }}>{new Date(tx.createdAt).toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: tx.amount > 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                  </div>
                  <div style={{ color: '#999', fontSize: 11 }}>Balance: {tx.balanceAfter.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}