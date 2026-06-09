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
    <div className="mb-6 rounded-xl border border-stone-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left rounded-xl"
      >
        <div className="flex items-center gap-2">
          <span className="text-violet-500 text-sm">ℹ️</span>
          <span className="text-sm font-medium text-stone-700">{purpose}</span>
        </div>
        <span className="text-stone-400 text-xs font-medium">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-stone-100 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {inputs && inputs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Yang perlu diisi</p>
              <ul className="space-y-1">
                {inputs.map((inp) => (
                  <li key={inp} className="text-sm text-stone-600 flex items-start gap-1.5">
                    <span className="mt-0.5 text-violet-400 text-xs">•</span>{inp}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {wiring && wiring.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Terhubung ke</p>
              <ul className="space-y-1.5">
                {wiring.map((w) => (
                  <li key={w.label} className="text-sm">
                    <span className="font-medium text-stone-700">{w.label}</span>
                    <span className="text-stone-500"> — {w.desc}</span>
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
