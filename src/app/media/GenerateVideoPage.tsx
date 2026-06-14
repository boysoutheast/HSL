'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

interface IgAccount { id: string; username: string; accountName: string | null }
interface PhotoRef { id: string; fileUrl: string; label: string }
interface VideoJob {
  id: string; prompt: string; status: string
  videoUrl?: string | null; errorMessage?: string | null
  instagramAccountId?: string | null; createdAt: string; completedAt?: string | null
  inputs?: { photoReference: { id: string; fileUrl: string; label: string } }[]
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'Antrian', processing: 'Proses', ready_for_rehost: 'Rehosting',
  completed: 'Selesai', failed: 'Gagal',
}
const STATUS_CLS: Record<string, string> = {
  queued: 'bg-amber-100 text-amber-700', processing: 'bg-blue-100 text-blue-700',
  ready_for_rehost: 'bg-cyan-100 text-cyan-700', completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function GenerateVideoPage() {
  const [accounts, setAccounts] = useState<IgAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [photos, setPhotos] = useState<PhotoRef[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [selectedRefs, setSelectedRefs] = useState<string[]>([])
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [jobs, setJobs] = useState<VideoJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Load accounts on mount (single fast call)
  useEffect(() => {
    fetch('/api/admin/accounts', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { accounts: [] })
      .then(d => setAccounts(d.accounts ?? []))
      .catch(() => {})
  }, [])

  const fetchJobs = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/generate/video?limit=30', { credentials: 'include' })
      if (!r.ok) throw new Error()
      const d = await r.json()
      setJobs(d.items ?? [])
    } catch { /* silent */ } finally {
      setLoadingJobs(false)
    }
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    const hasActive = jobs.some(j => ['queued', 'processing', 'ready_for_rehost'].includes(j.status))
    if (hasActive) pollRef.current = setInterval(fetchJobs, 12000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [jobs, fetchJobs])

  // Load photos when account selected
  useEffect(() => {
    if (!selectedAccount) { setPhotos([]); setSelectedRefs([]); return }
    setLoadingPhotos(true)
    setSelectedRefs([])
    fetch(`/api/admin/photos?instagramAccountId=${selectedAccount}&status=active`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { photos: [] })
      .then(d => setPhotos(d.photos ?? []))
      .catch(() => setPhotos([]))
      .finally(() => setLoadingPhotos(false))
  }, [selectedAccount])

  const toggleRef = (id: string) => {
    setSelectedRefs(prev =>
      prev.includes(id) ? prev.filter(p => p !== id)
        : prev.length < 5 ? [...prev, id] : prev
    )
  }

  const handleSubmit = async () => {
    setError('')
    if (!selectedAccount) { setError('Pilih akun Instagram dulu.'); return }
    if (!prompt.trim()) { setError('Prompt wajib diisi.'); return }
    setSubmitting(true)
    try {
      const r = await fetch('/api/admin/generate/video', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          instagramAccountId: selectedAccount,
          photoReferenceIds: selectedRefs,
        }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error ?? 'Gagal submit'); return }
      setPrompt('')
      setSelectedRefs([])
      await fetchJobs()
    } catch { setError('Network error') }
    finally { setSubmitting(false) }
  }

  const selectedAccountObj = accounts.find(a => a.id === selectedAccount)

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
        <h3 className="text-base font-semibold text-stone-800">Generate Video</h3>

        {/* 1. Account */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">1 · Pilih Akun</p>
          <div className="flex flex-wrap gap-2">
            {accounts.length === 0 && <p className="text-sm text-stone-400">Memuat akun...</p>}
            {accounts.map(a => (
              <button key={a.id} type="button"
                onClick={() => setSelectedAccount(a.id === selectedAccount ? '' : a.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  selectedAccount === a.id
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-violet-300'
                }`}
              >
                @{a.username}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Reference images — only after account picked */}
        {selectedAccount && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
              2 · Foto Referensi
              <span className="text-stone-300 font-normal normal-case ml-1">
                (masuk ke video · 1–5{selectedRefs.length > 0 ? ` · ${selectedRefs.length} dipilih` : ''})
              </span>
            </p>
            {loadingPhotos ? (
              <p className="text-sm text-stone-400">Memuat foto @{selectedAccountObj?.username}...</p>
            ) : photos.length === 0 ? (
              <p className="text-sm text-stone-400">
                Belum ada foto untuk @{selectedAccountObj?.username}. Upload di Library dulu.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                {photos.map(p => {
                  const sel = selectedRefs.includes(p.id)
                  const order = selectedRefs.indexOf(p.id)
                  return (
                    <button key={p.id} type="button" onClick={() => toggleRef(p.id)}
                      title={p.label}
                      className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition ${
                        sel ? 'border-violet-500 ring-2 ring-violet-200' : 'border-stone-200 hover:border-stone-400'
                      }`}
                    >
                      <img src={p.fileUrl} alt={p.label} className="w-full h-full object-cover" />
                      {sel && (
                        <div className="absolute inset-0 bg-violet-600/30 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{order + 1}</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. Prompt */}
        {selectedAccount && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">3 · Prompt</p>
            <textarea
              className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 resize-none h-24 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"
              placeholder="Deskripsikan video. Foto referensi yang dipilih akan dimasukkan ke dalam video."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3.5 py-2">{error}</p>}

        {selectedAccount && (
          <button type="button" disabled={submitting || !prompt.trim()} onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Mengirim...' : 'Generate Video'}
          </button>
        )}
      </div>

      {/* History */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-stone-800 mb-4">Riwayat</h3>
        {loadingJobs ? (
          <p className="text-sm text-stone-400 py-4">Memuat...</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-stone-400 py-4">Belum ada job.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => (
              <div key={job.id} className="flex items-start gap-3 p-3 rounded-xl border border-stone-100 hover:border-stone-200 transition">
                <div className="w-12 h-16 rounded-lg bg-stone-100 shrink-0 overflow-hidden">
                  {job.inputs?.[0]?.photoReference?.fileUrl
                    ? <img src={job.inputs[0].photoReference.fileUrl} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">—</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLS[job.status] ?? 'bg-stone-100 text-stone-500'}`}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </span>
                    <span className="text-xs text-stone-400">{fmtDate(job.createdAt)}</span>
                    {job.inputs && job.inputs.length > 0 && (
                      <span className="text-[10px] text-stone-400">{job.inputs.length} ref</span>
                    )}
                  </div>
                  <p className="text-sm text-stone-700 line-clamp-2">{job.prompt}</p>
                  {job.status === 'failed' && job.errorMessage && (
                    <p className="text-xs text-red-500 mt-1">{job.errorMessage}</p>
                  )}
                  {job.status === 'completed' && job.videoUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <video src={job.videoUrl} controls className="max-h-32 rounded-lg" />
                      <a href={job.videoUrl} download target="_blank" rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition">
                        Download
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
