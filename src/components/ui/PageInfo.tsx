'use client'
import { useState } from 'react'

interface Wire {
  label: string
  desc: string
}

interface PageInfoProps {
  purpose: string
  inputs?: string[]
  wiring?: Wire[]
}

export default function PageInfo({ purpose, inputs, wiring }: PageInfoProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors group"
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <span className="group-hover:underline">{purpose}</span>
        <svg
          className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 p-4 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-700/60 grid grid-cols-1 md:grid-cols-2 gap-4">
          {inputs && inputs.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Yang perlu diisi</p>
              <ul className="space-y-1">
                {inputs.map(inp => (
                  <li key={inp} className="text-xs text-stone-600 dark:text-stone-400 flex items-start gap-1.5">
                    <span className="mt-0.5 text-violet-400">•</span>{inp}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {wiring && wiring.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Terhubung ke</p>
              <ul className="space-y-1">
                {wiring.map(w => (
                  <li key={w.label} className="text-xs">
                    <span className="font-medium text-stone-700 dark:text-stone-300">{w.label}</span>
                    <span className="text-stone-400"> — {w.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
