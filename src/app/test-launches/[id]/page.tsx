'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import StatusBadge from '@/components/ui/StatusBadge'
import Table from '@/components/ui/Table'
import PageInfo from '@/components/ui/PageInfo'

interface Creative {
  id: string
  creativeUrl: string | null
  captionText: string | null
  hookText: string | null
  headline: string | null
  callToAction: string | null
  sortOrder: number
  status: string
}

interface MetaAccount {
  accountName: string
  adAccountId: string
}

interface ApprovalRequestSummary {
  id: string
  actionType: string
  status: string
  requestNote: string | null
  reviewNote: string | null
  createdAt: string
  reviewedAt: string | null
  requestedBy: { id: string; name: string | null; email: string }
  reviewedBy: { id: string; name: string | null; email: string } | null
}

interface WorkerTask {
  id: string
  type: string
  status: string
  priority: number
  attempts: number
  maxAttempts: number
  lastError: string | null
  workerId: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

interface TestLaunchDetail {
  id: string
  userId: string
  metaAccountId: string
  productId: string | null
  name: string
  objective: string
  dailyBudget: string
  targetingJson: string | null
  launchMode: string
  sourceAdsetId: string | null
  notes: string | null
  status: string
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  creatives: Creative[]
  approvalRequest: ApprovalRequestSummary | null
  metaAccount: MetaAccount
  workerTasks: WorkerTask[]
}

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_LEADS: 'Leads',
  OUTCOME_SALES: 'Sales',
  OUTCOME_TRAFFIC: 'Traffic',
}

const LAUNCH_MODE_LABELS: Record<string, string> = {
  new_test: 'Test Baru',
  duplicate_winner: 'Duplikat Winner',
}

const WORKER_TASK_TYPE_LABELS: Record<string, string> = {
  create_campaign: 'Buat Campaign',
  pause_ad: 'Jeda Iklan',
  scale_adset: 'Skala Adset',
  kill_ad: 'Stop Iklan',
  clone_adset: 'Clone Adset',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function TestLaunchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [testLaunch, setTestLaunch] = useState<TestLaunchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fetchTestLaunch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/test-launches/${id}`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTestLaunch(data.testLaunch ?? null)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchTestLaunch() }, [fetchTestLaunch])

  const handleSubmitForApproval = async () => {
    if (!testLaunch) return
    if (!confirm('Kirim Test Launch ini untuk approval?')) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/admin/test-launches/${id}/submit`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Server error (${res.status})`)
      }
      await fetchTestLaunch()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Memuat...</div>
  }

  if (!testLaunch) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-500">Test Launch tidak ditemukan.</p>
        <Link href="/" className="text-sm text-indigo-600 hover:underline">← Kembali</Link>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">Dashboard</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900">{testLaunch.name}</span>
      </div>

      <PageInfo
        purpose={`Detail Test Launch "${testLaunch.name}". Budget harian: Rp${Number(testLaunch.dailyBudget).toLocaleString()}, Mode: ${LAUNCH_MODE_LABELS[testLaunch.launchMode] ?? testLaunch.launchMode}.`}
        wiring={[
          { label: '→ Creative', desc: `${testLaunch.creatives.length} creative terattach` },
          { label: '→ Worker Tasks', desc: `${testLaunch.workerTasks.length} task` },
          { label: '→ Approval', desc: testLaunch.approvalRequest ? `status: ${testLaunch.approvalRequest.status}` : 'belum diajukan' },
        ]}
      />

      {/* Pending approval banner */}
      {testLaunch.status === 'pending_approval' && testLaunch.approvalRequest && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">Menunggu Approval</h3>
              <p className="text-sm text-yellow-800 mb-3">
                Test Launch ini telah diajukan untuk approval pada{' '}
                {formatDate(testLaunch.approvalRequest.createdAt)}.
                <br />
                Diajukan oleh: <strong>{testLaunch.approvalRequest.requestedBy.name ?? testLaunch.approvalRequest.requestedBy.email}</strong>
              </p>
              {testLaunch.approvalRequest.requestNote && (
                <div className="bg-yellow-100/60 rounded-lg p-3">
                  <p className="text-xs text-yellow-700 font-medium mb-0.5">Catatan Pengajuan:</p>
                  <p className="text-sm text-yellow-900">{testLaunch.approvalRequest.requestNote}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {testLaunch.errorMessage && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700">
            <strong>Error:</strong> {testLaunch.errorMessage}
          </p>
        </div>
      )}

      {/* Main Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{testLaunch.name}</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Dibuat {formatDate(testLaunch.createdAt)} · ID: <span className="font-mono text-xs">{testLaunch.id}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={testLaunch.status} />
            {testLaunch.status === 'draft' && (
              <button
                onClick={handleSubmitForApproval}
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? 'Mengirim...' : 'Submit for Approval'}
              </button>
            )}
          </div>
        </div>

        {submitError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            ⚠️ {submitError}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 text-sm">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Budget Harian</p>
            <p className="text-gray-900 font-semibold">Rp{Number(testLaunch.dailyBudget).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Objective</p>
            <p className="text-gray-900">{OBJECTIVE_LABELS[testLaunch.objective] ?? testLaunch.objective}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Launch Mode</p>
            <p className="text-gray-900">{LAUNCH_MODE_LABELS[testLaunch.launchMode] ?? testLaunch.launchMode}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Meta Account</p>
            <p className="text-gray-900">{testLaunch.metaAccount.accountName ?? testLaunch.metaAccountId}</p>
            <p className="text-xs text-gray-400">{testLaunch.metaAccount.adAccountId}</p>
          </div>
          {testLaunch.sourceAdsetId && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Source Adset ID</p>
              <p className="text-gray-900 font-mono text-xs">{testLaunch.sourceAdsetId}</p>
            </div>
          )}
          {testLaunch.targetingJson && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Targeting</p>
              <p className="text-gray-700 text-xs max-w-xs truncate">
                {(() => {
                  try { return JSON.parse(testLaunch.targetingJson!) } catch { return testLaunch.targetingJson }
                })()}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Updated</p>
            <p className="text-gray-700">{formatDate(testLaunch.updatedAt)}</p>
          </div>
        </div>

        {testLaunch.notes && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 font-medium mb-1">Notes</p>
            <p className="text-sm text-gray-700">{testLaunch.notes}</p>
          </div>
        )}
      </div>

      {/* Creatives */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            Creatives ({testLaunch.creatives.length})
          </h2>
        </div>

        {testLaunch.creatives.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            Tidak ada creative.
          </div>
        ) : (
          <div className="space-y-3">
            {testLaunch.creatives
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((creative) => (
                <div key={creative.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start gap-4">
                    {creative.creativeUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={creative.creativeUrl}
                        alt="creative"
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">
                        No Image
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={creative.status} />
                        {creative.callToAction && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            CTA: {creative.callToAction}
                          </span>
                        )}
                      </div>
                      {creative.headline && (
                        <p className="text-sm font-medium text-gray-900 mb-0.5">{creative.headline}</p>
                      )}
                      {creative.hookText && (
                        <p className="text-sm text-gray-700 mb-0.5">
                          <span className="text-gray-400 text-xs">Hook: </span>{creative.hookText}
                        </p>
                      )}
                      {creative.captionText && (
                        <p className="text-xs text-gray-500 line-clamp-2">{creative.captionText}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Approval Request */}
      {testLaunch.approvalRequest && (
        <div className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Approval Request</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <StatusBadge status={testLaunch.approvalRequest.status} />
              <span className="text-sm text-gray-600">
                {testLaunch.approvalRequest.actionType === 'create_campaign'
                  ? 'Buat Campaign'
                  : testLaunch.approvalRequest.actionType === 'duplicate_adset'
                  ? 'Duplikat Adset'
                  : testLaunch.approvalRequest.actionType}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Requested By</p>
                <p className="text-gray-900">
                  {testLaunch.approvalRequest.requestedBy.name ?? testLaunch.approvalRequest.requestedBy.email}
                </p>
                <p className="text-gray-400 text-xs">{formatDate(testLaunch.approvalRequest.createdAt)}</p>
              </div>

              {testLaunch.approvalRequest.reviewedBy && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Reviewed By</p>
                  <p className="text-gray-900">
                    {testLaunch.approvalRequest.reviewedBy.name ?? testLaunch.approvalRequest.reviewedBy.email}
                  </p>
                  <p className="text-gray-400 text-xs">{formatDate(testLaunch.approvalRequest.reviewedAt)}</p>
                </div>
              )}
            </div>

            {testLaunch.approvalRequest.requestNote && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 font-medium mb-0.5">Catatan Request:</p>
                <p className="text-sm text-gray-700">{testLaunch.approvalRequest.requestNote}</p>
              </div>
            )}

            {testLaunch.approvalRequest.reviewNote && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 font-medium mb-0.5">Catatan Review:</p>
                <p className="text-sm text-blue-900">{testLaunch.approvalRequest.reviewNote}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Worker Tasks */}
      {testLaunch.workerTasks.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Worker Tasks ({testLaunch.workerTasks.length})
          </h2>
          <Table
            headers={['Type', 'Status', 'Priority', 'Attempts', 'Worker ID', 'Created', 'Last Error']}
            empty="No worker tasks."
          >
            {testLaunch.workerTasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">
                  {WORKER_TASK_TYPE_LABELS[task.type] ?? task.type}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={task.status} />
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm">{task.priority}</td>
                <td className="px-4 py-3 text-gray-600 text-sm">
                  {task.attempts}/{task.maxAttempts}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                  {task.workerId ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {formatDate(task.createdAt)}
                </td>
                <td className="px-4 py-3 text-red-500 text-xs max-w-xs truncate">
                  {task.lastError ?? '—'}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  )
}
