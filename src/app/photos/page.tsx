'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import StatusBadge from '@/components/ui/StatusBadge'
import PageInfo from '@/components/ui/PageInfo'

interface Photo {
  id: string
  label: string
  category: string | null
  fileUrl: string
  thumbnailUrl: string | null
  status: string
  notes: string | null
  character: { id: string; name: string } | null
  instagramAccountId: string | null
  createdAt: string
}

interface Character {
  id: string
  name: string
}

const CATEGORY_COLORS: Record<string, string> = {
  face: 'bg-pink-100 text-pink-800',
  body: 'bg-purple-100 text-purple-800',
  product: 'bg-blue-100 text-blue-800',
  lifestyle: 'bg-green-100 text-green-800',
  background: 'bg-gray-100 text-gray-700',
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [filterCharacter, setFilterCharacter] = useState('ALL')
  const [filterCategory, setFilterCategory] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchPhotos = useCallback(async () => {
    try {
      const [photoRes, charRes] = await Promise.all([
        fetch('/api/admin/photos', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/characters', { cache: 'no-store', credentials: 'include' }),
      ])
      if (photoRes.ok) {
        const d = await photoRes.json()
        // API returns { photos: [...] }
        setPhotos(d.photos ?? d)
      }
      if (charRes.ok) {
        const d = await charRes.json()
        setCharacters(d.characters ?? d)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('label', file.name.replace(/\.[^.]+$/, ''))
      const res = await fetch('/api/photos/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      await fetchPhotos()
    } catch {
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const toggleStatus = async (photoId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    try {
      await fetch(`/api/admin/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })
      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, status: newStatus } : p))
      )
    } catch {
      alert('Failed to update status.')
    }
  }

  const categories = ['ALL', ...Array.from(new Set(photos.map((p) => p.category).filter(Boolean) as string[]))]

  const filtered = photos.filter((p) => {
    if (filterCharacter !== 'ALL' && p.character?.id !== filterCharacter) return false
    if (filterCategory !== 'ALL' && p.category !== filterCategory) return false
    if (filterStatus !== 'ALL' && p.status !== filterStatus) return false
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Photo References</h1>
          <p className="text-sm text-gray-500 mt-0.5">{photos.length} photo{photos.length !== 1 ? 's' : ''} total</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary"
          >
            {uploading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Photo
              </>
            )}
          </button>
        </div>
      </div>

      <PageInfo
        purpose="Foto referensi yang dikirim ke Hermes sebagai bahan visual konten. Hermes pakai URL foto ini untuk generate video/image."
        inputs={[
          'File foto (JPG/PNG/WebP)',
          'Label: deskripsi posisi/situasi foto (misal: ibu_duduk_pegang_betis)',
          'Category: character / product / lifestyle / face / full_body / before_after / other',
          'Relasi ke: Character, Topic, atau Product',
        ]}
        wiring={[
          { label: '→ Hermes Agent', desc: 'URL foto dikirim via /api/hermes/library dan /api/hermes/ready-upload' },
          { label: '→ Railway Volume', desc: 'file fisik disimpan di /data/photos, served via /api/photos/serve/[key]' },
          { label: '→ Content Log', desc: 'reference_image_id dicatat di setiap generate log' },
        ]}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5 bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Character</label>
          <select
            value={filterCharacter}
            onChange={(e) => setFilterCharacter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Characters</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Category</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          Loading photos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
          <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No photos found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((photo) => (
            <div
              key={photo.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Thumbnail */}
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {photo.thumbnailUrl || photo.fileUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.thumbnailUrl ?? photo.fileUrl}
                    alt={photo.label}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                {/* Status overlay */}
                {photo.status === 'inactive' && (
                  <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
                    <span className="text-white text-xs font-medium">Inactive</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 truncate">{photo.label}</p>
                {photo.character && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{photo.character.name}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  {photo.category ? (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[photo.category] ?? 'bg-gray-100 text-gray-700'}`}>
                      {photo.category}
                    </span>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() => toggleStatus(photo.id, photo.status)}
                    className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
                      photo.status === 'active'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {photo.status === 'active' ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
