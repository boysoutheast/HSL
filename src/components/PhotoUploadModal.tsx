'use client'

import { useState, useRef } from 'react'
import Modal from '@/components/ui/Modal'

interface PhotoUploadModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  instagramAccountId: string
}

const CATEGORIES = [
  'portrait',
  'full_body',
  'lifestyle',
  'product',
  'background',
  'other',
]

export default function PhotoUploadModal({ open, onClose, onSuccess, instagramAccountId }: PhotoUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setUploadError(null)
    // Generate preview
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(f)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !label.trim()) return
    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('label', label.trim())
      if (category) formData.append('category', category)
      formData.append('instagramAccountId', instagramAccountId)

      const res = await fetch('/api/photos/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401) { window.location.href = '/login'; return }
        throw new Error(data?.error ?? `Upload failed (${res.status})`)
      }

      // Reset & close
      setFile(null)
      setPreview(null)
      setLabel('')
      setCategory('')
      onClose()
      onSuccess()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    if (uploading) return // prevent close while uploading
    setFile(null)
    setPreview(null)
    setLabel('')
    setCategory('')
    setUploadError(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Upload Photo">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* File Drop Zone */}
        <div
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            preview
              ? 'border-violet-300 bg-violet-50/30'
              : 'border-stone-300 hover:border-violet-400 bg-stone-50'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />

          {preview ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Preview"
                className="max-h-48 mx-auto rounded-lg object-contain"
              />
              <p className="text-xs text-stone-400">
                {file?.name} ({(file!.size / 1024).toFixed(0)} KB)
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setFile(null)
                  setPreview(null)
                }}
                className="text-xs text-red-500 hover:underline"
              >
                Ganti file
              </button>
            </div>
          ) : (
            <div className="py-4">
              <svg className="w-10 h-10 mx-auto text-stone-300 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm text-stone-500 font-medium">Klik untuk pilih file</p>
              <p className="text-xs text-stone-400 mt-1">JPEG, PNG, WebP, GIF</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Contoh: Foto wajah close-up, tampak samping..."
              required
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">— tanpa kategori —</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {uploadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            ⚠️ {uploadError}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={handleClose} disabled={uploading} className="btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading || !file || !label.trim()}
            className="btn-primary"
          >
            {uploading ? 'Uploading...' : 'Upload Photo'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
