'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Table from '@/components/ui/Table'
import PageInfo from '@/components/ui/PageInfo'

interface TestLaunch {
  id: string
  name: string
  dailyBudget: string | number
  status: string
  launchMode: string
  objective: string
  createdAt: string
  metaAccount: {
    accountName: string | null
    adAccountId: string
  }
  creatives: Array<{
    id: string
    creativeUrl: string | null
    captionText: string | null
    hookText: string | null
    headline: string | null
    callToAction: string | null
  }>
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-cyan-100 text-cyan-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  executing: 'bg-blue-100 text-blue-800',
  completed: 'bg-stone-100 text-stone-600',
  failed: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  executing: 'Executing',
  completed: 'Completed',
  failed: 'Failed',
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-stone-100 text-stone-600'
  const label = STATUS_LABELS[status] ?? status
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>
      {label}
    </span>
  )
}

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_LEADS: 'Leads',
  OUTCOME_SALES: 'Sales',
  OUTCOME_TRAFFIC: 'Traffic',
}

export default function TestLaunchesPage() {
  const router = useRouter()
  const [launches, setLaunches] = useState<TestLaunch[]>([])
  const [loading, setLoading] = useState(true)
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  const fetchLaunches = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/test-launches', { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLaunches(data.testLaunches ?? [])
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLaunches() }, [fetchLaunches])

  const handleSubmitForApproval = async (id: string) => {
    if (!confirm('Submit this launch for approval?')) return
    setSubmittingId(id)
    try {
      const res = await fetch(`/api/admin/test-launches/${id}/submit`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed')
      }
      await fetchLaunches()
    } catch (err) {
      alert('Gagal submit: ' + String(err))
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Test Launches</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {loading ? '...' : `${launches.length} launch`}
          </p>
        </div>
        <Link href="/test-launches/new" className="btn-primary">
          + New Launch
        </Link>
      </div>

      <PageInfo
        purpose="Kelola Meta Ads test launch. Draft bisa disubmit untuk approval sebelum dieksekusi."
        inputs={['Nama launch', 'Meta Account', 'Budget harian', 'Objective', 'Launch mode']}
        wiring={[
          { label: '→ Meta Accounts', desc: 'setiap launch terikat satu Meta Ads account' },
          { label: '→ Approval', desc: 'draft harus di-approve admin sebelum executing' },
          { label: '→ Worker Task', desc: 'setelah approved, task dibuat untuk worker Meta API' },
        ]}
      />

      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">Loading...</div>
      ) : (
        <Table
          headers={['Nama', 'Akun', 'Budget/Hari', 'Objective', 'Status', 'Creatives', 'Created', 'Actions']}
          empty="No test launches found."
        >
          {launches.map((launch) => (
            <tr key={launch.id} className="hover:bg-stone-50 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-stone-900">{launch.name}</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Mode: {launch.launchMode === 'new_test' ? 'New Test' : 'Duplicate Winner'}
                </p>
              </td>
              <td className="px-4 py-3">
                <p className="text-sm text-stone-700">
                  {launch.metaAccount.accountName ?? launch.metaAccount.adAccountId}
                </p>
                <p className="text-xs text-stone-400">{launch.metaAccount.adAccountId}</p>
              </td>
              <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
                Rp {Number(launch.dailyBudget).toLocaleString('id-ID')}
              </td>
              <td className="px-4 py-3 text-stone-600">
                {OBJECTIVE_LABELS[launch.objective] ?? launch.objective}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={launch.status} />
              </td>
              <td className="px-4 py-3 text-stone-600 text-center">
                {launch.creatives.length}
              </td>
              <td className="px-4 py-3 text-stone-500 text-sm whitespace-nowrap">
                {new Date(launch.createdAt).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/test-launches/${launch.id}`} className="btn-info btn-sm">
                    Detail
                  </Link>
                  {launch.status === 'draft' && (
                    <button
                      onClick={() => handleSubmitForApproval(launch.id)}
                      disabled={submittingId === launch.id}
                      className="btn-success btn-sm"
                    >
                      {submittingId === launch.id ? '...' : 'Submit'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
