'use client'

import { useEffect, useState, useCallback } from 'react'

/* ── Types ── */
interface PhotoRef {
  id: string
  fileUrl: string | null
  label: string | null
}

interface GenInput {
  photoReference: PhotoRef | null
  inputOrder: number
}

interface GeneratedMedia {
  id: string
  prompt: string
  status: string // queued | processing | ready_for_rehost | completed | failed
  videoUrl: string | null
  thumbnailUrl: string | null
  errorMessage: string | null
  instagramAccountId: string | null
  workerTaskId: string | null
  createdAt: string
  completedAt: string | null
  inputs: GenInput[]
}

interface IGAccount {
  id: string
  username: string
}

interface Pagination {
  total: number
  limit: number
  offset: number
}

/* ── Status helpers ── */
const STATUS_LABEL: Record<string, string> = {
  queued: 'Antri',
  processing: 'Memproses',
  ready_for_rehost: 'Siap Upload',
  completed: 'Selesai',
  failed: 'Gagal',
}

const STATUS_CLASS: Record<string, string> = {
  queued: 'bg-stone-100 text-stone-600',
  processing: 'bg-blue-100 text-blue-700',
  ready_for_rehost: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
}

const POLL_INTERVAL = 12_000

/* ── Component ── */
export default function GenerateVideoPage() {
  const [prompt, setPrompt] = useState('')
  const [photoRefs, setPhotoRefs] = useState<PhotoRef[]>([])
  const [selectedRefIds, setSelectedRefIds] = useState<string[]>([])
  const [igAccountId, setIgAccountId] = useState('')
  const [igAccounts, setIgAccounts] = useState<IGAccount[]>([])
  const [jobs, setJobs] = useState<GeneratedMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  /* ── Fetch IG accounts ── */
  useEffect(() => {
    fetch('/api/admin/meta-connections?type=ig-accounts', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setIgAccounts(d.metaAccounts ?? d))
      .catch(() => {})
  }, [])

  /* ── Fetch photo references ── */
  useEffect(() => {
    fetch('/api/admin/media-assets?type=photo-reference&limit=50', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const items = d.mediaAssets ?? d.items ?? d ?? []
        if (Array.isArray(items)) setPhotoRefs(items)
      })
      .catch(() => {})
  }, [])

  /* ── Fetch jobs + polling ── */
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/generate/video?limit=20', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setJobs(data.items ?? [])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchJobs()
    const id = setInterval(fetchJobs, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchJobs])

  /* ── Toggle photo ref selection ── */
  const toggleRef = (id: string) => {
    setSelectedRefIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 5 ? [...prev, id] : prev
    )
  }

  /* ── Submit ── */
  const handleSubmit = async () => {
    const trimmed = prompt.trim()
    if (!trimmed) return

    setSubmitting(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const res = await fetch('/api/admin/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: trimmed,
          photoReferenceIds: selectedRefIds,
          instagramAccountId: igAccountId || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Gagal (${res.status})`)

      setPrompt('')
      setSelectedRefIds([])
      setIgAccountId('')
      setSuccessMsg('Job video berhasil dibuat!')

      // Refresh list immediately
      await fetchJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal submit')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Form Card ── */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-stone-900 mb-4">Generate Video Baru</h2>

        {/* Success / Error */}
        {successMsg && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">
            ✅ {successMsg}
          </div>
        )}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            ⚠️ {error}
          </div>
        )}

        {/* Prompt */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Prompt <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-300"
            rows={3}
            placeholder="Deskripsi video yang ingin dibuat..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />
        </div>

        {/* Photo Reference Picker */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Foto Referensi ({selectedRefIds.length}/5)
          </label>
          {photoRefs.length === 0 ? (
            <p className="text-xs text-stone-400 italic">Tidak ada foto referensi. Upload gambar dulu di tab Library.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {photoRefs.slice(0, 30).map(ref => {
                const sel = selectedRefIds.includes(ref.id)
                return (
                  <button
                    key={ref.id}
                    onClick={() => toggleRef(ref.id)}
                    className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      sel ? 'border-violet-500 ring-2 ring-violet-200' : 'border-stone-200 hover:border-stone-400'
                    }`}
                    title={ref.label ?? ref.id.slice(0, 8)}
                  >
                    {ref.fileUrl && (
                      <img src={ref.fileUrl} alt="" className="w-full h-full object-cover" />
                    )}
                    {sel && (
                      <span className="absolute top-0.5 right-0.5 bg-violet-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                        {selectedRefIds.indexOf(ref.id) + 1}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* IG Account */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Akun Instagram (opsional)
          </label>
          <select
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            value={igAccountId}
            onChange={e => setIgAccountId(e.target.value)}
          >
            <option value="">— Pilih akun —</option>
            {igAccounts.map(ig => (
              <option key={ig.id} value={ig.id}>@{ig.username ?? ig.id}</option>
            ))}
          </select>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !prompt.trim()}
          className="btn-primary"
        >
          {submitting ? '🔄 Mengirim...' : '✨ Generate Video'}
        </button>
      </div>

      {/* ── Job List ── */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-stone-900 mb-4">Daftar Job ({jobs.length})</h2>

        {loading ? (
          <div className="flex items-center justify-center h-32 text-sm text-stone-400">Memuat...</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-2xl mb-2">🎬</p>
            <p className="text-sm font-semibold text-stone-700 mb-1">Belum ada job</p>
            <p className="text-sm text-stone-400">Buat job pertama dengan form di atas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => {
              const refImg = job.inputs?.[0]?.photoReference?.fileUrl
              const pending = job.status === 'queued' || job.status === 'processing' || job.status === 'ready_for_rehost'

              return (
                <div
                  key={job.id}
                  className="flex items-start gap-4 p-3 rounded-xl border border-stone-100 hover:border-stone-200 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0 flex items-center justify-center">
                    {job.thumbnailUrl ? (
                      <img src={job.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : refImg ? (
                      <img src={refImg} alt="" className="w-full h-full object-cover" />
                    ) : job.status === 'completed' && job.videoUrl ? (
                      <div className="text-2xl">▶️</div>
                    ) : (
                      <div className="text-stone-300 text-lg">🎬</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">{job.prompt}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_CLASS[job.status] ?? 'bg-stone-100 text-stone-500'}`}>
                        {STATUS_LABEL[job.status] ?? job.status}
                      </span>
                      <span className="text-[11px] text-stone-400">
                        {new Date(job.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {pending && (
                        <span className="text-[11px] text-blue-500 font-medium">⏳ {POLL_INTERVAL / 1000}s refresh otomatis</span>
                      )}
                    </div>
                    {job.errorMessage && (
                      <p className="text-xs text-red-500 mt-1 truncate">⚠️ {job.errorMessage}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0">
                    {job.status === 'completed' && job.videoUrl && (
                      <div className="flex gap-2">
                        <a
                          href={job.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary btn-sm"
                        >
                          ▶ Lihat
                        </a>
                        <a
                          href={job.videoUrl}
                          download
                          className="btn-ghost btn-sm"
                        >
                          ⬇
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
