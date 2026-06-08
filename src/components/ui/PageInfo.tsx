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
    <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-blue-500 text-lg">ℹ️</span>
          <span className="text-sm font-medium text-blue-800">{purpose}</span>
        </div>
        <span className="text-blue-400 text-xs">{open ? '▲ tutup' : '▼ detail'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-blue-100 mt-0 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {inputs && inputs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">📝 Yang perlu diisi</p>
              <ul className="space-y-1">
                {inputs.map((inp) => (
                  <li key={inp} className="text-xs text-blue-800 flex items-start gap-1.5">
                    <span className="mt-0.5 text-blue-400">•</span>{inp}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {wiring && wiring.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">🔗 Terhubung ke</p>
              <ul className="space-y-1.5">
                {wiring.map((w) => (
                  <li key={w.label} className="text-xs">
                    <span className="font-semibold text-blue-800">{w.label}</span>
                    <span className="text-blue-600"> — {w.desc}</span>
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
