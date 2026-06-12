'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type ResultType = 'launch' | 'instagram' | 'product' | 'media'

interface SearchResult {
  id: string
  label: string
  type: ResultType
  href: string
  subtitle?: string
}

export default function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`, { credentials: 'include' })
      const data = await res.json()
      setResults(data.results ?? [])
      setIndex(0)
    }, 200)
    return () => clearTimeout(timer)
  }, [open, query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault(); setIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault(); setIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && results[index]) {
        e.preventDefault(); router.push(results[index].href); setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, index, router])

  const grouped = useMemo(() => {
    const order: ResultType[] = ['launch', 'instagram', 'product', 'media']
    return order.map((type) => ({ type, items: results.filter((r) => r.type === type) })).filter((g) => g.items.length > 0)
  }, [results])

  if (!open) return null

  let flatIndex = -1
  return (
    <div className="fixed inset-0 z-[100] bg-black/30 p-4 md:p-16" onClick={() => setOpen(false)}>
      <div className="mx-auto max-w-2xl rounded-2xl bg-white shadow-2xl border border-stone-200" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-stone-200 px-4 py-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari launch, IG account, produk, media..."
            className="w-full outline-none text-sm"
          />
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-2">
          {grouped.length === 0 ? (
            <div className="px-3 py-8 text-sm text-stone-500">Ketik minimal 2 huruf.</div>
          ) : grouped.map((group) => (
            <div key={group.type} className="mb-3">
              <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-stone-400">{group.type}</div>
              {group.items.map((item) => {
                flatIndex += 1
                const active = flatIndex === index
                return (
                  <button
                    key={item.type + item.id}
                    onClick={() => { router.push(item.href); setOpen(false) }}
                    className={`w-full rounded-xl px-3 py-2 text-left ${active ? 'bg-stone-900 text-white' : 'hover:bg-stone-100 text-stone-800'}`}
                  >
                    <div className="text-sm font-medium">{item.label}</div>
                    {item.subtitle ? <div className={`text-xs ${active ? 'text-stone-300' : 'text-stone-500'}`}>{item.subtitle}</div> : null}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
