'use client'
import { useState, useEffect, useRef } from 'react'
import { HELP } from '@/lib/help-content'

interface HelpHintProps {
  k: keyof typeof HELP
  side?: 'top' | 'bottom'
  className?: string
}

export function HelpHint({ k, side = 'bottom', className = '' }: HelpHintProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  // useEffect HARUS sebelum conditional return (rules-of-hooks — cegah React #310)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])

  const entry = HELP[k]
  if (!entry) return null   // fail-safe: key gak ada → jangan render apa-apa

  return (
    <span ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={`Bantuan: ${entry.title}`}
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-stone-400 text-stone-400 text-[10px] leading-none hover:border-violet-500 hover:text-violet-500 transition"
      >?</button>
      {open && (
        <span
          role="tooltip"
          className={`absolute z-50 ${side === 'bottom' ? 'top-5' : 'bottom-5'} left-1/2 -translate-x-1/2 w-max max-w-[240px] rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-lg p-2.5 text-left`}
        >
          <span className="block text-xs font-semibold text-stone-800 dark:text-stone-100">{entry.title}</span>
          <span className="block text-[11px] text-stone-600 dark:text-stone-300 mt-0.5 leading-snug">{entry.body}</span>
        </span>
      )}
    </span>
  )
}
