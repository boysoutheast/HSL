'use client'

import Link from 'next/link'

export default function PerformancePage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Performance</h1>
        <p className="mt-1 text-sm text-stone-500">
          Performance reporting saat ini dibuka lewat Logs tab performance. Halaman ini jadi entry point yang jujur, bukan redirect diam-diam.
        </p>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h2 className="text-sm font-semibold text-blue-900">Lokasi metric sekarang</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-blue-800">
          <li>Performance snapshot ada di halaman Logs.</li>
          <li>Halaman ini dipertahankan sebagai pointer supaya menu lama tidak terasa rusak.</li>
          <li>Next refinement: pecah jadi module performance mandiri kalau memang dibutuhkan.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/logs?tab=performance" className="btn-primary">Buka Performance Logs</Link>
          <Link href="/ads?tab=monitor" className="btn-ghost">Buka Monitor</Link>
        </div>
      </div>
    </div>
  )
}
