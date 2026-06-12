'use client'

import Link from 'next/link'

export default function AssignmentsPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Assignments</h1>
        <p className="mt-1 text-sm text-stone-500">
          Assignment sekarang dikelola terpusat dari halaman Agents. Halaman ini tidak lagi punya workflow terpisah.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-sm font-semibold text-amber-900">Kenapa halaman ini diubah</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">
          <li>Supaya tidak ada duplikasi flow antara Assignments dan Agents.</li>
          <li>Semua relasi Account / Character / Topic / Product / CEP sekarang dikelola dari satu tempat.</li>
          <li>Ini mencegah dead end redirect yang membingungkan.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/system?tab=agents" className="btn-primary">Buka Agents</Link>
          <Link href="/system?tab=docs" className="btn-ghost">Lihat Docs</Link>
        </div>
      </div>
    </div>
  )
}
