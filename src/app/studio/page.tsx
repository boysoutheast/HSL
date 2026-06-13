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
  errorMessage: string | null
  refundedAt: string | null
  createdAt: string
  completedAt: string | null
}

const COST = 1300

export default function StudioPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [history, setHistory] = useState<GeneratedMedia[]>([])
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const fetchState = useCallback(async () => {
    if (!apiKey) return
    try {
      const [credRes, histRes] = await Promise.all([
        fetch('/api/hermes/credits', { headers: { authorization: `Bearer ${apiKey}` } }),
        fetch('/api/hermes/credits?limit=50', { headers: { authorization: `Bearer ${apiKey}` } }),
      ])
      if (credRes.ok) {
        const data = await credRes.json()
        setBalance(data.balance)
        setTransactions(data.transactions ?? [])
      }
      if (histRes.ok) {
        const data = await histRes.json()
        setHistory(data.transactions ?? data.transactions ?? [])
      }
    } catch {
      // ignore
    }
  }, [apiKey])

  // Fetch API key from profile endpoint
  useEffect(() => {
    fetch('/api/admin/profile/api-key')
      .then(r => r.json())
      .then(d => {
        if (d.agent) {
          // Key was generated previously — we need it from storage
          // For MVP, API key must be manually entered or stored
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (apiKey) {
      fetchState()
      const interval = setInterval(fetchState, 12000)
      return () => clearInterval(interval)
    }
  }, [apiKey, fetchState])

  const handleGenerate = async () => {
    if (!apiKey || !prompt.trim()) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/hermes/generate/video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      const data = await res.json()
      if (res.status === 402) {
        setError(`Insufficient credits: balance ${data.balance}, required ${data.required}`)
      } else if (!res.ok) {
        setError(data.error ?? 'Generation failed')
      } else {
        setPrompt('')
        setError(null)
        await fetchState()
      }
    } catch {
      setError('Network error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Media Studio</h1>

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
        <div style={{ marginBottom: 24, padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 13, color: '#666' }}>Credit Balance</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>
            {balance !== null ? balance.toLocaleString() : '—'}
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
            Video generation costs {COST.toLocaleString()} credits
          </div>
        </div>
      )}

      {/* Generate Form */}
      {apiKey && (
        <div style={{ marginBottom: 32 }}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe the video you want to generate..."
            rows={3}
            style={{ width: '100%', padding: 12, fontSize: 14, border: '1px solid #ddd', borderRadius: 8, resize: 'vertical' }}
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            style={{
              marginTop: 8,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              background: generating ? '#ccc' : '#000',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? 'Generating...' : `Generate Video — ${COST.toLocaleString()} credits`}
          </button>
          {error && (
            <div style={{ marginTop: 8, padding: 8, background: '#fef2f2', color: '#dc2626', borderRadius: 6, fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* Transaction History */}
      {apiKey && transactions.length > 0 && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Transaction History</h2>
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
