'use client'

import { useEffect } from 'react'

type LightboxPhoto = {
  fileUrl: string
  label?: string | null
  category?: string | null
}

type Props = {
  photo: LightboxPhoto | null
  onClose: () => void
}

export default function PhotoLightbox({ photo, onClose }: Props) {
  // Tutup dengan tombol Escape
  useEffect(() => {
    if (!photo) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [photo, onClose])

  if (!photo) return null

  const handleDownload = async () => {
    try {
      const res = await fetch(photo.fileUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const filename = photo.fileUrl.split('/').pop() || photo.label || 'photo'
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Fallback: buka di tab baru
      window.open(photo.fileUrl, '_blank')
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center gap-3"
        onClick={e => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.fileUrl}
          alt={photo.label ?? 'Foto referensi'}
          className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl"
        />

        {/* Info bar + tombol */}
        <div className="flex items-center gap-3 bg-black/60 rounded-xl px-4 py-2.5 w-full justify-between">
          <div className="text-sm text-white/80 min-w-0">
            {photo.label && (
              <span className="font-medium text-white truncate block">{photo.label}</span>
            )}
            {photo.category && (
              <span className="text-white/50 text-xs">{photo.category}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              ⬇ Download
            </button>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              ✕ Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
