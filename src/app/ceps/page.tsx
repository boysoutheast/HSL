'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import StatusBadge from '@/components/ui/StatusBadge'
import PageInfo from '@/components/ui/PageInfo'

interface Cep {
  id: string
  cepText: string
  painPoint: string | null
  angle: string | null
  source: string
  status: string
  notes: string | null
  createdAt: string
  topic: { id: string; name: string } | null
  product: { id: string; name: string } | null
  createdByHermesId: string | null
}

const TABS = [
  { label: 'Active', value: 'active' },
  { label: 'Pending Review', value: 'pending_review' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Inactive', value: 'inactive' },
]

export default function CepsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-48 text-stone-400 text-sm">Loading...</div>}>
      <CepsPageInner />
    </Suspense>
  )
}

function CepsPageInner() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') ?? 'active'

  const [ceps, setCeps] = useState<Cep[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchCeps = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ceps', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error()
      setCeps(await res.json())
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCeps()
  }, [fetchCeps])

  const handleApprove = async (id: string) => {
    setActionLoading(`approve-${id}`)
    try {
      const res = await fetch(`/api/admin/ceps/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'active' }),
      })
      if (!res.ok) throw new Error()
      await fetchCeps()
    } catch {
      console.error('Failed to approve CEP.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id: string) => {
    setActionLoading(`reject-${id}`)
    try {
      const res = await fetch(`/api/admin/ceps/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'rejected' }),
      })
      if (!res.ok) throw new Error()
      await fetchCeps()
    } catch {
      console.error('Failed to reject CEP.')
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = ceps.filter((c) => c.status === activeTab)

  const tabCount = (tab: string) => ceps.filter((c) => c.status === tab).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">CEP Management</h1>
          <p className="text-sm text-stone-500 mt-0.5">{ceps.length} total CEPs</p>
        </div>
        <button
          title="CEP baru dibuat oleh AI Buddy Agent — tidak dibuat manual via UI"
          disabled
          className="cursor-not-allowed rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm font-medium text-stone-400"
        >
          + Add CEP
        </button>
      </div>

      <PageInfo
        purpose="Customer Entry Point — kalimat pembuka konten yang menyentuh pain point audiens. CEP dari AI Buddy masuk sebagai Pending dan butuh approval admin dulu."
        inputs={[
          'CEP text: kalimat pembuka (misal: Kulit kaki penderita diabetes makin kering saat malam.)',
          'Pain point: masalah spesifik yang disentuh',
          'Angle: sudut pandang cerita',
          'Relasi ke Topic atau Product',
        ]}
        wiring={[
          { label: '← AI Buddy Agent', desc: 'AI Buddy submit CEP baru via POST /api/hermes/cep-feedback (status: pending_review)' },
          { label: '→ AI Buddy Agent', desc: "hanya CEP status 'active' yang dikirim ke AI Buddy" },
          { label: '→ Content Log', desc: 'cep_id dicatat di setiap konten yang dibuat AI Buddy' },
        ]}
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-stone-200 mb-4">
        {TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === value
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {label}
            <span
              className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === value
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-stone-100 text-stone-500'
              }`}
            >
              {tabCount(value)}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">
          Loading CEPs...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                {['CEP Text', 'Topic', 'Product', 'Source', 'Status', 'Created', ...(activeTab === 'pending_review' ? ['Actions'] : [])].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                    No CEPs in this status.
                  </td>
                </tr>
              ) : (
                filtered.map((cep) => (
                  <tr key={cep.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 max-w-[300px]">
                      <p className="line-clamp-3 text-stone-800">{cep.cepText}</p>
                      {cep.painPoint && (
                        <p className="text-xs text-stone-400 mt-1 truncate">Pain: {cep.painPoint}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {cep.topic?.name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {cep.product?.name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          cep.source === 'ai'
                            ? 'bg-violet-100 text-violet-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {cep.source === 'ai' ? 'AI' : 'Human'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={cep.status} />
                    </td>
                    <td className="px-4 py-3 text-stone-400 text-xs whitespace-nowrap">
                      {new Date(cep.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    {activeTab === 'pending_review' && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(cep.id)}
                            disabled={actionLoading === `approve-${cep.id}`}
                            className="btn-success btn-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(cep.id)}
                            disabled={actionLoading === `reject-${cep.id}`}
                            className="btn-danger btn-sm"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
