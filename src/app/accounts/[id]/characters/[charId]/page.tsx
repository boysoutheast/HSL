'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import StatusBadge from '@/components/ui/StatusBadge'
import PageInfo from '@/components/ui/PageInfo'
import Modal from '@/components/ui/Modal'
import PhotoLightbox from '@/components/PhotoLightbox'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Character {
  id: string
  name: string
  description: string
  behavior: string | null
  speakingStyle: string | null
  expressionStyle: string | null
  movementStyle: string | null
  forbiddenRules: string | null
  status: string
  instagramAccount: { id: string; username: string }
}

interface Photo {
  id: string
  fileUrl: string
  label: string
  category: string | null
  status: string
  createdAt: string
}

interface Cep {
  id: string
  cepText: string
  painPoint: string | null
  angle: string | null
  source: string
  status: string
  topicId?: string | null
}

interface Topic {
  id: string
  name: string
  description: string
  status: string
  ceps?: Cep[]
  _count?: { ceps: number }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'
const textareaCls = `${inputCls} resize-none`

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CharacterDetailPage() {
  const params = useParams()
  const accountId = params.id as string
  const charId = params.charId as string

  const [activeTab, setActiveTab] = useState<'info' | 'photos' | 'topics'>('info')
  const [character, setCharacter] = useState<Character | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchCharacter = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/characters/${charId}`, { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCharacter(data.character ?? data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [charId])

  useEffect(() => { fetchCharacter() }, [fetchCharacter])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-stone-400 text-sm">Loading...</div>
  }

  if (!character) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-stone-500">Character not found.</p>
        <Link href={`/accounts/${accountId}`} className="text-sm text-violet-600 hover:underline">Back to Account</Link>
      </div>
    )
  }

  const TABS = [
    { key: 'info', label: 'Info' },
    { key: 'photos', label: 'Photos' },
    { key: 'topics', label: 'Topics & CEPs' },
  ] as const

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm flex-wrap">
        <Link href="/accounts" className="text-stone-500 hover:text-stone-700">Accounts</Link>
        <span className="text-gray-300">/</span>
        <Link href={`/accounts/${accountId}`} className="text-stone-500 hover:text-stone-700">
          @{character.instagramAccount.username}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-stone-900">{character.name}</span>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-stone-200 mb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <InfoTab character={character} charId={charId} onSaved={fetchCharacter} />
      )}
      {activeTab === 'photos' && (
        <PhotosTab charId={charId} />
      )}
      {activeTab === 'topics' && (
        <TopicsTab charId={charId} />
      )}
    </div>
  )
}

// ─── Tab 1: Info ──────────────────────────────────────────────────────────────

function InfoTab({ character, charId, onSaved }: { character: Character; charId: string; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: character.name,
    description: character.description,
    behavior: character.behavior ?? '',
    speakingStyle: character.speakingStyle ?? '',
    expressionStyle: character.expressionStyle ?? '',
    movementStyle: character.movementStyle ?? '',
    forbiddenRules: character.forbiddenRules ?? '',
    status: character.status,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/characters/${charId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          behavior: form.behavior.trim() || undefined,
          speakingStyle: form.speakingStyle.trim() || undefined,
          expressionStyle: form.expressionStyle.trim() || undefined,
          movementStyle: form.movementStyle.trim() || undefined,
          forbiddenRules: form.forbiddenRules.trim() || undefined,
          status: form.status,
        }),
      })
      if (!res.ok) throw new Error()
      setSaveError(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved()
    } catch {
      setSaveError('Failed to save character.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageInfo
        purpose="Edit detail persona karakter ini"
        inputs={['name', 'persona (description)', 'advanced: behavior, speaking style, expression, movement, forbidden rules, status']}
        wiring={[{ label: '→ Hermes API', desc: 'data karakter dikirim via /api/hermes/library' }]}
      />
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        {/* Nama */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Nama <span className="text-red-500">*</span></label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputCls} />
        </div>

        {/* Persona */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Persona</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={5}
            placeholder="Latar belakang, kepribadian, cara komunikasi karakter..."
            className={textareaCls}
          />
        </div>

        {/* Toggle Advanced */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          <span className={`transition-transform inline-block ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
          Detail Karakter Lanjutan
        </button>

        {showAdvanced && (
          <div className="space-y-3 pl-4 border-l-2 border-gray-100">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Behavior</label>
              <textarea value={form.behavior} onChange={(e) => setForm({ ...form, behavior: e.target.value })} rows={2} className={textareaCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Speaking Style</label>
              <textarea value={form.speakingStyle} onChange={(e) => setForm({ ...form, speakingStyle: e.target.value })} rows={2} className={textareaCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Expression Style</label>
              <textarea value={form.expressionStyle} onChange={(e) => setForm({ ...form, expressionStyle: e.target.value })} rows={2} className={textareaCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Movement Style</label>
              <textarea value={form.movementStyle} onChange={(e) => setForm({ ...form, movementStyle: e.target.value })} rows={2} className={textareaCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Forbidden Rules</label>
              <textarea value={form.forbiddenRules} onChange={(e) => setForm({ ...form, forbiddenRules: e.target.value })} rows={2} className={textareaCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
          </div>
        )}

        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            ⚠️ {saveError}
          </div>
        )}
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="btn-success">
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Tab 2: Photos ─────────────────────────────────────────────────────────────

function PhotosTab({ charId }: { charId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadLabel, setUploadLabel] = useState('')
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploading, setUploading] = useState(false)
  const [editLabelId, setEditLabelId] = useState<string | null>(null)
  const [editLabelVal, setEditLabelVal] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [lightboxPhoto, setLightboxPhoto] = useState<{
    fileUrl: string; label?: string | null; category?: string | null
  } | null>(null)

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/characters/${charId}`, { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const char = data.character ?? data
      setPhotos(char.photoReferences ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [charId])

  useEffect(() => { fetchPhotos() }, [fetchPhotos])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('label', uploadLabel || uploadFile.name)
      fd.append('characterId', charId)
      if (uploadCategory) fd.append('category', uploadCategory)
      const res = await fetch('/api/photos/upload', { method: 'POST', body: fd, credentials: 'include' })
      if (!res.ok) throw new Error()
      setPhotoError(null)
      setShowUpload(false)
      setUploadFile(null)
      setUploadLabel('')
      setUploadCategory('')
      await fetchPhotos()
    } catch {
      setPhotoError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleEditLabel = async (photoId: string) => {
    setActionLoading(`label-${photoId}`)
    try {
      const res = await fetch(`/api/admin/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label: editLabelVal }),
      })
      if (!res.ok) throw new Error()
      setPhotoError(null)
      setEditLabelId(null)
      await fetchPhotos()
    } catch {
      setPhotoError('Failed to save label.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Hapus foto ini permanen?')) return
    setActionLoading(`delete-${photoId}`)
    try {
      const res = await fetch(`/api/admin/photos/${photoId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      setPhotoError(null)
      await fetchPhotos()
    } catch {
      setPhotoError('Gagal hapus foto.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      <PageInfo
        purpose="Foto referensi untuk karakter ini. Hermes pakai URL foto ini untuk generate video."
        inputs={['File (JPG/PNG/WebP)', 'Label: deskripsi posisi foto', 'Category']}
        wiring={[
          { label: '→ Railway Volume', desc: '/data/photos' },
          { label: '→ Hermes', desc: 'via /api/hermes/library' },
        ]}
      />

      {photoError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ⚠️ {photoError}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-stone-800">Foto Referensi</h3>
          <p className="text-sm text-stone-500 mt-0.5">
            {loading ? '...' : `${photos.filter(p => p.status === 'active').length} foto aktif`}
          </p>
        </div>
        <button onClick={() => setShowUpload(!showUpload)} className="btn-primary btn-sm">
          + Tambah Foto
        </button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <form onSubmit={handleUpload} className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">File <span className="text-red-500">*</span></label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                required
                className="w-full text-sm text-stone-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-violet-600 file:text-white hover:file:bg-violet-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Label</label>
              <input
                type="text"
                value={uploadLabel}
                onChange={(e) => setUploadLabel(e.target.value)}
                placeholder="e.g. close-up wajah"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Category</label>
              <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className={inputCls}>
                <option value="">— pilih —</option>
                <option value="portrait">portrait</option>
                <option value="full_body">full_body</option>
                <option value="expression">expression</option>
                <option value="product">product</option>
                <option value="lifestyle">lifestyle</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowUpload(false)} className="btn-ghost btn-sm">Cancel</button>
            <button type="submit" disabled={uploading || !uploadFile} className="btn-primary">
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-stone-400 text-sm">Loading photos...</div>
      ) : photos.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-stone-400 text-sm bg-white rounded-xl border border-stone-200">
          No photos yet. Upload a photo to get started.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-square bg-stone-100 border border-stone-200">
              {/* Klik foto → buka lightbox */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.fileUrl}
                alt={photo.label}
                className="w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition-transform duration-200"
                onClick={() => setLightboxPhoto(photo)}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              {/* Hover overlay — actions */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2 pointer-events-none">
                {editLabelId === photo.id ? (
                  <div className="w-full space-y-1.5 pointer-events-auto" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editLabelVal}
                      onChange={(e) => setEditLabelVal(e.target.value)}
                      className="w-full border border-white/30 bg-white/10 text-white rounded px-2 py-1 text-xs placeholder-white/50"
                      autoFocus
                    />
                    <button
                      onClick={() => handleEditLabel(photo.id)}
                      disabled={actionLoading === `label-${photo.id}`}
                      className="w-full bg-green-500 text-white text-xs py-1 rounded hover:bg-green-600"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="w-full flex flex-col gap-1.5 pointer-events-auto">
                    <p className="text-white text-xs text-center font-medium truncate w-full px-1">{photo.label}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditLabelId(photo.id); setEditLabelVal(photo.label) }}
                      className="bg-white/20 text-white text-xs px-3 py-1 rounded hover:bg-white/30 w-full"
                    >
                      Edit Label
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id) }}
                      disabled={actionLoading === `delete-${photo.id}`}
                      className="bg-red-500 text-white text-xs px-3 py-1 rounded hover:bg-red-600 w-full"
                    >
                      {actionLoading === `delete-${photo.id}` ? '...' : 'Hapus'}
                    </button>
                  </div>
                )}
              </div>
              {/* Inactive badge */}
              {photo.status !== 'active' && (
                <div className="absolute top-1 right-1 bg-gray-800/80 text-white text-xs px-1.5 py-0.5 rounded pointer-events-none">
                  inactive
                </div>
              )}
              {/* Category badge */}
              {photo.category && (
                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded pointer-events-none">
                  {photo.category}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <PhotoLightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
    </div>
  )
}

// ─── Tab 3: Topics & CEPs ─────────────────────────────────────────────────────

function TopicsTab({ charId }: { charId: string }) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null)
  const [topicCeps, setTopicCeps] = useState<Record<string, Cep[]>>({})
  const [loadingCeps, setLoadingCeps] = useState<string | null>(null)

  // Topic modal
  const [showTopicModal, setShowTopicModal] = useState(false)
  const [editTopic, setEditTopic] = useState<Topic | null>(null)
  const [topicForm, setTopicForm] = useState({ name: '', description: '' })
  const [savingTopic, setSavingTopic] = useState(false)
  const [topicError, setTopicError] = useState<string | null>(null)

  // CEP modal
  const [showCepModal, setShowCepModal] = useState(false)
  const [cepForTopicId, setCepForTopicId] = useState<string | null>(null)
  const [cepText, setCepText] = useState('')
  const [savingCep, setSavingCep] = useState(false)
  const [cepError, setCepError] = useState<string | null>(null)

  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/topics?characterId=${charId}`, { cache: 'no-store', credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setTopics(data.topics ?? data)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [charId])

  useEffect(() => { fetchAll() }, [fetchAll])

  const fetchCepsForTopic = useCallback(async (topicId: string) => {
    setLoadingCeps(topicId)
    try {
      const res = await fetch(`/api/admin/ceps?topicId=${topicId}&status=active`, { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTopicCeps((prev) => ({ ...prev, [topicId]: data.ceps ?? data }))
    } catch {
      // silent
    } finally {
      setLoadingCeps(null)
    }
  }, [])

  const toggleExpand = (topicId: string) => {
    if (expandedTopicId === topicId) {
      setExpandedTopicId(null)
    } else {
      setExpandedTopicId(topicId)
      fetchCepsForTopic(topicId)
    }
  }

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingTopic(true)
    try {
      const url = editTopic ? `/api/admin/topics/${editTopic.id}` : '/api/admin/topics'
      const method = editTopic ? 'PATCH' : 'POST'
      const body = editTopic
        ? { name: topicForm.name.trim(), description: topicForm.description.trim() }
        : { name: topicForm.name.trim(), description: topicForm.description.trim(), characterId: charId }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      setTopicError(null)
      setShowTopicModal(false)
      setEditTopic(null)
      setTopicForm({ name: '', description: '' })
      await fetchAll()
    } catch {
      setTopicError('Failed to save topic.')
    } finally {
      setSavingTopic(false)
    }
  }

  const handleDeleteTopic = async (topicId: string, topicName: string) => {
    if (!confirm(`Hapus topik "${topicName}" beserta semua CEP-nya?\n\nTidak bisa dibatalkan.`)) return
    setActionLoading(`topic-${topicId}`)
    try {
      const res = await fetch(`/api/admin/topics/${topicId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      setActionError(null)
      await fetchAll()
    } catch {
      setActionError('Gagal hapus topik.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleAddCep = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cepForTopicId || !cepText.trim()) return
    setSavingCep(true)
    try {
      const res = await fetch('/api/admin/ceps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          topicId: cepForTopicId,
          cepText: cepText.trim(),
          source: 'human',
          status: 'active',
        }),
      })
      if (!res.ok) throw new Error()
      setCepError(null)
      setShowCepModal(false)
      setCepText('')
      await fetchCepsForTopic(cepForTopicId)
    } catch {
      setCepError('Failed to save CEP.')
    } finally {
      setSavingCep(false)
    }
  }

  const handleDeactivateCep = async (cepId: string, topicId: string) => {
    setActionLoading(cepId)
    try {
      const res = await fetch(`/api/admin/ceps/${cepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'inactive' }),
      })
      if (!res.ok) throw new Error()
      setActionError(null)
      setTopicCeps(prev => ({ ...prev, [topicId]: (prev[topicId] ?? []).filter(c => c.id !== cepId) }))
    } catch {
      setActionError('Failed to deactivate CEP.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteCep = async (cepId: string, topicId: string) => {
    if (!confirm('Hapus CEP ini permanen?')) return
    setActionLoading(`del-${cepId}`)
    try {
      const res = await fetch(`/api/admin/ceps/${cepId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      setActionError(null)
      setTopicCeps(prev => ({ ...prev, [topicId]: (prev[topicId] ?? []).filter(c => c.id !== cepId) }))
    } catch {
      setActionError('Gagal hapus CEP.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      <PageInfo
        purpose="Topik bahasan + CEP untuk karakter ini. Hermes pilih topik dan CEP dari sini untuk generate konten."
        inputs={['Topic: nama + deskripsi', 'CEP: kalimat pembuka yang menyentuh pain point']}
        wiring={[
          { label: '→ Hermes /api/hermes/ready-upload', desc: 'topik dan CEP dipilih saat Hermes generate konten' },
          { label: '→ Content Log', desc: 'cep_id dicatat tiap konten' },
        ]}
      />

      {actionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ⚠️ {actionError}
        </div>
      )}

      {/* ── Topics List ── */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-stone-800">
          Topics ({loading ? '...' : topics.length})
        </h3>
        <button
          onClick={() => { setEditTopic(null); setTopicForm({ name: '', description: '' }); setShowTopicModal(true) }}
          className="btn-primary"
        >
          + Add Topic
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-stone-400 text-sm">Loading topics...</div>
      ) : topics.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-stone-400 text-sm bg-white rounded-xl border border-stone-200">
          No topics yet.
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => {
            const isExpanded = expandedTopicId === topic.id
            const ceps = topicCeps[topic.id] ?? []
            return (
              <div key={topic.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                {/* Topic row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    onClick={() => toggleExpand(topic.id)}
                    className="flex items-center gap-3 text-left flex-1 min-w-0"
                  >
                    <span className="text-stone-400 text-sm">{isExpanded ? '▼' : '▶'}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-stone-900 truncate">{topic.name}</p>
                      <p className="text-xs text-stone-400 truncate mt-0.5">{topic.description}</p>
                    </div>
                    <StatusBadge status={topic.status} />
                  </button>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditTopic(topic)
                        setTopicForm({ name: topic.name, description: topic.description })
                        setShowTopicModal(true)
                      }}
                      className="btn-warning btn-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTopic(topic.id, topic.name)}
                      disabled={actionLoading === `topic-${topic.id}`}
                      className="btn-danger btn-sm"
                    >
                      {actionLoading === `topic-${topic.id}` ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>

                {/* Expanded: Active CEPs */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 bg-stone-50">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-stone-700">
                        CEPs ({loadingCeps === topic.id ? '...' : ceps.length})
                      </p>
                      <button
                        onClick={() => { setCepForTopicId(topic.id); setCepText(''); setShowCepModal(true) }}
                        className="btn-primary btn-sm"
                      >
                        + Add CEP
                      </button>
                    </div>

                    {loadingCeps === topic.id ? (
                      <p className="text-xs text-stone-400 text-center py-4">Loading CEPs...</p>
                    ) : ceps.length === 0 ? (
                      <p className="text-xs text-stone-400 text-center py-4">No CEPs yet. Add one manually or let Hermes write one.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {ceps.map((cep) => (
                          <div key={cep.id} className="flex items-start justify-between gap-3 py-1.5">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <span className={`mt-0.5 flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                                cep.source === 'ai'
                                  ? 'bg-violet-100 text-violet-600'
                                  : 'bg-stone-100 text-stone-500'
                              }`}>
                                {cep.source === 'ai' ? 'AI' : 'Manual'}
                              </span>
                              <p className="text-sm text-stone-700 leading-relaxed">&ldquo;{cep.cepText}&rdquo;</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => handleDeactivateCep(cep.id, topic.id)}
                                disabled={!!actionLoading}
                                className="text-gray-300 hover:text-orange-400 transition-colors text-lg leading-none"
                                title="Nonaktifkan"
                              >
                                {actionLoading === cep.id ? '·' : '×'}
                              </button>
                              <button
                                onClick={() => handleDeleteCep(cep.id, topic.id)}
                                disabled={!!actionLoading}
                                className="text-gray-300 hover:text-red-600 transition-colors text-xs leading-none"
                                title="Hapus permanen"
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Topic Modal */}
      <Modal
        open={showTopicModal}
        onClose={() => { setShowTopicModal(false); setEditTopic(null) }}
        title={editTopic ? `Edit Topic: ${editTopic.name}` : 'Add Topic'}
      >
        <form onSubmit={handleSaveTopic} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={topicForm.name}
              onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Description <span className="text-red-500">*</span></label>
            <textarea
              value={topicForm.description}
              onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
              rows={3}
              required
              className={textareaCls}
            />
          </div>
          {topicError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              ⚠️ {topicError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowTopicModal(false); setEditTopic(null); setTopicError(null) }} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={savingTopic} className="btn-primary">
              {savingTopic ? 'Saving...' : editTopic ? 'Save Changes' : 'Add Topic'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CEP Modal */}
      <Modal
        open={showCepModal}
        onClose={() => { setShowCepModal(false); setCepError(null) }}
        title="Add CEP"
      >
        <form onSubmit={handleAddCep} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
            <strong>CEP</strong> (Content Entry Point) adalah kalimat pembuka yang langsung menyentuh pain point audiens — membuat mereka berhenti scroll dan merasa &ldquo;ini gue banget&rdquo;.
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Hook Text <span className="text-red-500">*</span></label>
            <textarea
              value={cepText}
              onChange={(e) => setCepText(e.target.value)}
              placeholder="Kalimat pembuka yang menyentuh pain point audiens..."
              rows={4}
              required
              className={textareaCls}
              autoFocus
            />
          </div>
          {cepError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              ⚠️ {cepError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowCepModal(false); setCepError(null) }} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={savingCep || !cepText.trim()} className="btn-primary">
              {savingCep ? 'Saving...' : 'Add CEP'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
