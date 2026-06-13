'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

interface PhotoRef {
  id: string
  fileUrl: string
  label?: string | null
  character?: { name: string } | null
}

interface VideoJob {
  id: string
  prompt: string
  status: string
  videoUrl?: string | null
  thumbnailUrl?: string | null
  errorMessage?: string | null
  instagramAccountId?: string | null
  createdAt: string
  completedAt?: string | null
  inputs?: { photoReference: { id: string; fileUrl: string; label?: string | null } }[]
}

interface IgAccount {
  id: string
  username: string
}

const STATUS_BADGE: Record<string, string> = {
  queued: 'badge-accent',
  processing: 'badge-processing',
  ready_for_rehost: 'badge-accent',
  completed: 'badge-success',
  failed: 'badge-error',
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  processing: 'Processing',
  ready_for_rehost: 'Rehosting',
  completed: 'Completed',
  failed: 'Failed',
}

export default function GenerateVideoPage() {
  const [photos, setPhotos] = useState<PhotoRef[]>([])
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([])
  const [igAccounts, setIgAccounts] = useState<IgAccount[]>([])
  const [selectedIg, setSelectedIg] = useState('')
  const [prompt, setPrompt] = useState('')
  const [jobs, setJobs] = useState<VideoJob[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [pageError, setPageError] = useState('')
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const fetchPhotos = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/photos', { credentials: 'include' })
      if (!r.ok) return
      const d = await r.json()
      setPhotos(d.photos ?? [])
    } catch { /* ignore */ }
  }, [])

  const fetchIgAccounts = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/meta-connections', { credentials: 'include' })
      if (!r.ok) return
      const d = await r.json()
      const accounts: IgAccount[] = []
      for (const conn of d.connections ?? []) {
        for (const page of conn.pages ?? []) {
          if (page.igUsername && page.igBusinessAccountId) {
            accounts.push({ id: page.igBusinessAccountId, username: page.igUsername })
          }
        }
      }
      setIgAccounts(accounts)
    } catch { /* ignore */ }
  }, [])

  const fetchJobs = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/generate/video?limit=30', { credentials: 'include' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      setJobs(d.items ?? [])
      setLoadingJobs(false)
      setPageError('')
    } catch (e: any) {
      setPageError(e.message ?? 'Gagal fetch jobs')
      setLoadingJobs(false)
    }
  }, [])

  useEffect(() => {
    fetchPhotos()
    fetchIgAccounts()
    fetchJobs()
  }, [fetchPhotos, fetchIgAccounts, fetchJobs])

  useEffect(() => {
    // Poll every 12s for active jobs
    const hasActive = jobs.some(j => j.status === 'queued' || j.status === 'processing' || j.status === 'ready_for_rehost')
    if (pollRef.current) clearInterval(pollRef.current)
    if (hasActive) {
      pollRef.current = setInterval(fetchJobs, 12000)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [jobs, fetchJobs])

  const togglePhoto = (id: string) => {
    setSelectedPhotoIds(prev =>
      prev.includes(id)
        ? prev.filter(p => p !== id)
        : prev.length < 5
          ? [...prev, id]
          : prev
    )
  }

  const handleSubmit = async () => {
    setError('')
    if (!prompt.trim()) {
      setError('Prompt wajib diisi.')
      return
    }
    if (selectedPhotoIds.length < 1 || selectedPhotoIds.length > 5) {
      setError('Pilih 1–5 foto referensi.')
      return
    }
    setSubmitting(true)
    try {
      const body: any = { prompt: prompt.trim(), photoReferenceIds: selectedPhotoIds }
      if (selectedIg) body.instagramAccountId = selectedIg
      const r = await fetch('/api/admin/generate/video', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) {
        setError(d.error ?? 'Gagal submit')
        return
      }
      setPrompt('')
      setSelectedPhotoIds([])
      setSelectedIg('')
      await fetchJobs()
    } catch (e: any) {
      setError(e.message ?? 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (s: string) =>
    new Date(s).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-stone-800">Generate Video Baru</h3>

        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1.5">
            Prompt <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 resize-none h-24 placeholder:text-stone-400"
            placeholder="Deskripsikan video yang ingin dibuat..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />
        </div>

        {/* Photo picker */}
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1.5">
            Foto Referensi <span className="text-red-500">*</span>
            <span className="text-stone-400 font-normal ml-1">(pilih 1–5)</span>
            {selectedPhotoIds.length > 0 && (
              <span className="text-violet-600 ml-1">• {selectedPhotoIds.length} dipilih</span>
            )}
          </label>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {photos.length === 0 && (
              <p className="text-xs text-stone-400 py-2">Tidak ada foto referensi. Upload foto dulu di Photos.</p>
            )}
            {photos.map(p => {
              const sel = selectedPhotoIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePhoto(p.id)}
                  className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 transition ${
                    sel ? 'border-violet-500 ring-2 ring-violet-200' : 'border-stone-200 hover:border-stone-400'
                  }`}
                >
                  <img src={p.fileUrl} alt={p.label ?? 'photo'} className="w-full h-full object-cover" />
                  {sel && (
                    <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* IG picker */}
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1.5">Akun Instagram (opsional)</label>
          <select
            className="border border-stone-300 rounded-xl px-3.5 py-2 text-sm text-stone-800 w-full max-w-xs"
            value={selectedIg}
            onChange={e => setSelectedIg(e.target.value)}
          >
            <option value="">Tanpa akun IG</option>
            {igAccounts.map(a => (
              <option key={a.id} value={a.id}>@{a.username}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3.5 py-2">{error}</div>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="btn-primary"
        >
          {submitting ? 'Mengirim...' : 'Generate Video'}
        </button>
      </div>

      {/* Job list */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-stone-800 mb-4">Riwayat Generate</h3>

        {pageError && (
          <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3.5 py-2 mb-4">{pageError}</div>
        )}

        {loadingJobs && (
          <div className="flex items-center gap-2 text-sm text-stone-400 py-4">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Memuat...
          </div>
        )}

        {!loadingJobs && jobs.length === 0 && !pageError && (
          <p className="text-sm text-stone-400 py-4">Belum ada job generate. Buat job baru di form atas.</p>
        )}

        {!loadingJobs && jobs.length > 0 && (
          <div className="space-y-3">
            {jobs.map(job => (
              <div key={job.id} className="flex items-start gap-3 p-3 rounded-xl border border-stone-100 hover:border-stone-200 transition">
                {/* Thumbnail */}
                <div className="w-14 h-20 rounded-lg bg-stone-100 flex-shrink-0 overflow-hidden">
                  {job.inputs?.[0]?.photoReference?.fileUrl ? (
                    <img
                      src={job.inputs[0].photoReference.fileUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : job.videoUrl ? (
                    <video src={job.videoUrl} className="w-full h-full object-cover" />
                  ) : job.thumbnailUrl ? (
                    <img src={job.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge-xs ${STATUS_BADGE[job.status] ?? 'badge-inactive'}`}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </span>
                    <span className="text-xs text-stone-400">{formatDate(job.createdAt)}</span>
                    {job.completedAt && (
                      <span className="text-xs text-stone-400">→ {formatDate(job.completedAt)}</span>
                    )}
                  </div>
                  <p className="text-sm text-stone-700 mt-1 line-clamp-2">{job.prompt}</p>

                  {job.status === 'failed' && job.errorMessage && (
                    <p className="text-xs text-red-500 mt-1">{job.errorMessage}</p>
                  )}

                  {job.status === 'completed' && job.videoUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <video src={job.videoUrl} controls className="max-w-xs max-h-36 rounded-lg" />
                      <a
                        href={job.videoUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-outline btn-xs"
                      >
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
