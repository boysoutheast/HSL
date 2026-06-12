'use client'

import Link from 'next/link'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <div className="w-16 h-16 mb-6 rounded-full bg-amber-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-stone-900 mb-2">Ada yang tidak beres</h2>
      <p className="text-sm text-stone-500 mb-6 max-w-md">{error.message || 'Terjadi error tak terduga.'}</p>
      <div className="flex gap-3">
        <button onClick={reset} className="btn-primary">Coba Lagi</button>
        <Link href="/" className="btn-ghost">Ke Dashboard</Link>
      </div>
    </div>
  )
}
