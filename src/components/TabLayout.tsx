'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface Tab {
  id: string
  label: string
  href: string
}

export default function TabLayout({ tabs, children }: { tabs: Tab[]; children: React.ReactNode }) {
  const params = useSearchParams()
  const active = params.get('tab') || tabs[0]?.id

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        {tabs.map((t) => {
          const isActive = active === t.id
          return (
            <Link
              key={t.id}
              href={t.href}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive ? 'bg-violet-600 text-white shadow-sm' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              {t.label}
            </Link>
          )
        })}
      </div>
      <div>{children}</div>
    </div>
  )
}
