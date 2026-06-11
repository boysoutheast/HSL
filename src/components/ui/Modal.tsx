'use client'

import React, { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: string
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-xl',
}: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) {
      document.addEventListener('keydown', handler)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className={`relative z-10 w-full ${maxWidth} bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700 overflow-hidden animate-in`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-50">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
