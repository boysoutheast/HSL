'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import StatusBadge from '@/components/ui/StatusBadge'
import Table from '@/components/ui/Table'
import PageInfo from '@/components/ui/PageInfo'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Creative {
  id: string
  creativeUrl: string | null
  captionText: string | null
  hookText: string | null
  headline: string | null
  primaryText: string | null
  adHeadline: string | null
  callToAction: string | null
  sortOrder: number
  status: string
}

interface MetaConnection {
  id: string
  name: string | null
  appId: string | null
  status: string
  accountName: string | null
  adAccounts: Array<{ id: string; adAccountId: string; adAccountName: string | null; currency: string | null }>
  pages: Array<{ id: string; pageId: string; pageName: string | null; igBusinessAccountId: string | null; igUsername: string | null }>
}

interface AdAccount {
  id: string
  adAccountId: string
  adAccountName: string | null
  currency: string | null
}

interface ApprovalRequest {
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
  payloadJson?: string | null
  resultJson?: string | null
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
  metaBusinessId: string | null
  metaAdAccountId: string | null
  productId: string | null
  name: string
  objective: string
  dailyBudget: string
  currency: string
  pageId: string | null
  igAccountId: string | null
  placementMode: string
  placementsJson: string | null
  audienceJson: string | null
  targetingJson: string | null
  destinationUrl: string | null
  launchMode: string
  sourceAdsetId: string | null
  notes: string | null
  status: string
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  creatives: Creative[]
  approvalRequest: ApprovalRequest | null
  metaAccount: MetaConnection
  metaAdAccount: AdAccount | null
  workerTasks: WorkerTask[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_LEADS: 'Leads',
  OUTCOME_SALES: 'Sales',
  OUTCOME_TRAFFIC: 'Traffic',
}

const LAUNCH_MODE_LABELS: Record<string, string> = {
  new_test: 'Test Baru',
  duplicate_winner: 'Duplikat Winner',
}

const PLACEMENT_LABELS: Record<string, string> = {
  facebook_feed: 'Facebook Feed',
  facebook_stories: 'Facebook Stories',
  instagram_feed: 'Instagram Feed',
  instagram_stories: 'Instagram Stories',
  instagram_reels: 'Instagram Reels',
  instagram_explore: 'Instagram Explore',
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  create_campaign: 'Buat Campaign',
  duplicate_adset: 'Duplikat Adset',
  increase_budget: 'Naikkan Budget',
  pause_ad: 'Jeda Iklan',
}

const WORKER_TASK_TYPE_LABELS: Record<string, string> = {
  create_campaign: 'Buat Campaign',
  pause_ad: 'Jeda Iklan',
  scale_adset: 'Skala Adset',
  kill_ad: 'Stop Iklan',
  clone_adset: 'Clone Adset',
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

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('id-ID', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function parseAudience(audienceJson: string | null): { ageMin: number; ageMax: number; gender: string; locations: Array<{ type: string; key: string }> } | null {
  if (!audienceJson) return null
  try { return JSON.parse(audienceJson) } catch { return null }
}

function parsePlacements(placementsJson: string | null): string[] {
  if (!placementsJson) return []
  try { return JSON.parse(placementsJson) } catch { return [] }
}

function parseWorkerResult(resultJson: string | null | undefined): { ok: boolean; mode: string; campaignId?: string; message?: string } | null {
  if (!resultJson) return null
  try { return JSON.parse(resultJson) } catch { return null }
}

// ─── Component ────────────────────────────────────────────────────────────────

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
      if (res.status === 401) {
        router.replace(`/login?redirect=/test-launches/${id}`)
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setTestLaunch(data.testLaunch ?? null)
    } catch (err) {
      console.error('fetchTestLaunch error:', err)
    } finally {
      setLoading(false)
    }
  }, [id, router])

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
    return <div className="flex items-center justify-center h-64 text-stone-400 text-sm">Memuat...</div>
  }

  if (!testLaunch) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-stone-500">Test Launch tidak ditemukan.</p>
        <Link href="/ads?tab=launch" className="text-sm text-violet-600 hover:underline">← Kembali ke Test Launches</Link>
      </div>
    )
  }

  const audience = parseAudience(testLaunch.audienceJson)
  const placements = parsePlacements(testLaunch.placementsJson)
  const metaAccount = testLaunch.metaAccount
  const selectedPage = metaAccount?.pages?.find((p) => p.pageId === testLaunch.pageId)
  const statusCls = STATUS_COLORS[testLaunch.status] ?? 'bg-stone-100 text-stone-600'
  const statusLabel = STATUS_LABELS[testLaunch.status] ?? testLaunch.status

  return (
    <div>

      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-2">
        <Link href="/ads?tab=launch" className="text-sm text-stone-500 hover:text-stone-700">Test Launches</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-stone-900">{testLaunch.name}</span>
      </div>

      <PageInfo
        purpose={`Detail Test Launch "${testLaunch.name}". Budget harian: Rp${Number(testLaunch.dailyBudget).toLocaleString()}, Mode: ${LAUNCH_MODE_LABELS[testLaunch.launchMode] ?? testLaunch.launchMode}.`}
        wiring={[
          { label: '→ Creative', desc: `${testLaunch.creatives.length} creative terattach` },
          { label: '→ Worker Tasks', desc: `${testLaunch.workerTasks.length} task` },
          { label: '→ Approval', desc: testLaunch.approvalRequest ? `status: ${testLaunch.approvalRequest.status}` : 'belum diajukan' },
        ]}
      />

      {/* ── Pending Approval Banner ──────────────────────────────────────── */}
      {testLaunch.status === 'pending_approval' && testLaunch.approvalRequest && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">Menunggu Approval</h3>
              <p className="text-sm text-yellow-800 mb-3">
                Test Launch ini telah diajukan untuk approval pada {formatDate(testLaunch.approvalRequest.createdAt)}.
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

      {/* ── Approved / Execution Banner ─────────────────────────────────── */}
      {testLaunch.status === 'approved' && testLaunch.approvalRequest?.status === 'approved' && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <h3 className="font-semibold text-green-900 mb-1">Approved — siap diproses Hermes Worker</h3>
              <p className="text-sm text-green-800">
                Test Launch ini sudah diapprove pada {formatDate(testLaunch.approvalRequest.reviewedAt)}.
                <br />
                Direview oleh: <strong>{testLaunch.approvalRequest.reviewedBy?.name ?? testLaunch.approvalRequest.reviewedBy?.email ?? '—'}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Error Banner ───────────────────────────────────────────────── */}
      {testLaunch.errorMessage && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700">
            <strong>Error:</strong> {testLaunch.errorMessage}
          </p>
        </div>
      )}

      {/* ── Main Header Card ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">{testLaunch.name}</h1>
            <p className="text-stone-500 text-sm mt-0.5">
              Dibuat {formatDate(testLaunch.createdAt)} · ID: <span className="font-mono text-xs">{testLaunch.id}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${statusCls}`}>
              {statusLabel}
            </span>
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

        {/* Summary Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 text-sm">
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Budget Harian</p>
            <p className="text-stone-900 font-semibold">
              Rp{Number(testLaunch.dailyBudget).toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-stone-400">{testLaunch.currency}</p>
          </div>

          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Objective</p>
            <p className="text-stone-900">{OBJECTIVE_LABELS[testLaunch.objective] ?? testLaunch.objective}</p>
          </div>

          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Launch Mode</p>
            <p className="text-stone-900">{LAUNCH_MODE_LABELS[testLaunch.launchMode] ?? testLaunch.launchMode}</p>
          </div>

          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Meta Connection</p>
            <p className="text-stone-900">{metaAccount?.name ?? metaAccount?.appId ?? testLaunch.metaAccountId}</p>
            <p className="text-xs text-stone-400">{metaAccount?.status}</p>
          </div>

          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Ad Account</p>
            <p className="text-stone-900">{testLaunch.metaAdAccount?.adAccountName ?? testLaunch.metaAdAccount?.adAccountId ?? testLaunch.metaAdAccountId ?? '—'}</p>
            <p className="text-xs text-stone-400">{testLaunch.metaAdAccount?.adAccountId ?? testLaunch.metaAdAccountId ?? 'belum dipilih'}</p>
          </div>

          {selectedPage && (
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Facebook Page</p>
              <p className="text-stone-900">{selectedPage.pageName ?? selectedPage.pageId}</p>
            </div>
          )}

          {selectedPage?.igUsername && (
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Instagram</p>
              <p className="text-pink-700">@{selectedPage.igUsername}</p>
            </div>
          )}

          {testLaunch.destinationUrl && (
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Destination URL</p>
              <a
                href={testLaunch.destinationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 text-xs hover:underline truncate block max-w-[200px]"
              >
                {testLaunch.destinationUrl}
              </a>
            </div>
          )}

          {testLaunch.sourceAdsetId && (
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Source Adset ID</p>
              <p className="text-stone-900 font-mono text-xs">{testLaunch.sourceAdsetId}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Placement</p>
            <p className="text-stone-900">
              {testLaunch.placementMode === 'automatic'
                ? '⚡ Automatic'
                : placements.length > 0
                ? placements.map((p) => PLACEMENT_LABELS[p] ?? p).join(', ')
                : '—'}
            </p>
          </div>

          {audience && (
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Audience</p>
              <p className="text-stone-900">
                {audience.ageMin}–{audience.ageMax} th · {audience.gender} · {audience.locations?.[0]?.key ?? '—'}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Updated</p>
            <p className="text-stone-700">{formatDate(testLaunch.updatedAt)}</p>
          </div>
        </div>

        {testLaunch.notes && (
          <div className="mt-4 p-3 bg-stone-50 rounded-lg">
            <p className="text-xs text-stone-500 font-medium mb-1">Notes</p>
            <p className="text-sm text-stone-700 whitespace-pre-wrap">{testLaunch.notes}</p>
          </div>
        )}
      </div>

      {/* ── Creatives ──────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-stone-900">
            Creatives ({testLaunch.creatives.length})
          </h2>
        </div>

        {testLaunch.creatives.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-400 text-sm">
            Tidak ada creative.
          </div>
        ) : (
          <div className="space-y-3">
            {testLaunch.creatives
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((creative) => (
                <div key={creative.id} className="bg-white rounded-xl border border-stone-200 p-4">
                  <div className="flex items-start gap-4">
                    {creative.creativeUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={creative.creativeUrl}
                        alt="creative"
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-stone-100 rounded-lg flex-shrink-0 flex items-center justify-center text-stone-400 text-xs">
                        No Image
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[creative.status] ?? 'bg-stone-100 text-stone-600'}`}>
                          {creative.status}
                        </span>
                        {creative.callToAction && (
                          <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded">
                            CTA: {creative.callToAction}
                          </span>
                        )}
                        <span className="text-xs text-stone-400">#{creative.sortOrder + 1}</span>
                      </div>

                      {creative.headline && (
                        <p className="text-sm font-medium text-stone-900">{creative.headline}</p>
                      )}
                      {creative.primaryText && (
                        <p className="text-sm text-stone-700 whitespace-pre-wrap">
                          <span className="text-stone-400 text-xs mr-1">Primary:</span>{creative.primaryText}
                        </p>
                      )}
                      {creative.hookText && (
                        <p className="text-xs text-stone-500">
                          <span className="text-stone-400">Hook:</span> {creative.hookText}
                        </p>
                      )}
                      {creative.captionText && (
                        <p className="text-xs text-stone-400 line-clamp-2">
                          Caption: {creative.captionText}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── Approval Request ────────────────────────────────────────────── */}
      {testLaunch.approvalRequest && (
        <div className="mb-6">
          <h2 className="text-base font-semibold text-stone-900 mb-3">Approval Request</h2>
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <StatusBadge status={testLaunch.approvalRequest.status} />
              <span className="text-sm text-stone-600">
                {ACTION_TYPE_LABELS[testLaunch.approvalRequest.actionType] ?? testLaunch.approvalRequest.actionType}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Requested By</p>
                <p className="text-stone-900">
                  {testLaunch.approvalRequest.requestedBy.name ?? testLaunch.approvalRequest.requestedBy.email}
                </p>
                <p className="text-stone-400 text-xs">{formatDate(testLaunch.approvalRequest.createdAt)}</p>
              </div>

              {testLaunch.approvalRequest.reviewedBy && (
                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Reviewed By</p>
                  <p className="text-stone-900">
                    {testLaunch.approvalRequest.reviewedBy.name ?? testLaunch.approvalRequest.reviewedBy.email}
                  </p>
                  <p className="text-stone-400 text-xs">{formatDate(testLaunch.approvalRequest.reviewedAt)}</p>
                </div>
              )}
            </div>

            {testLaunch.approvalRequest.requestNote && (
              <div className="mt-3 p-3 bg-stone-50 rounded-lg">
                <p className="text-xs text-stone-500 font-medium mb-0.5">Catatan Request:</p>
                <p className="text-sm text-stone-700 whitespace-pre-wrap">{testLaunch.approvalRequest.requestNote}</p>
              </div>
            )}

            {testLaunch.approvalRequest.reviewNote && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 font-medium mb-0.5">Catatan Review:</p>
                <p className="text-sm text-blue-900 whitespace-pre-wrap">{testLaunch.approvalRequest.reviewNote}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Worker Tasks ────────────────────────────────────────────────── */}
      {testLaunch.workerTasks.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-stone-900 mb-3">
            Execution ({testLaunch.workerTasks.length} task)
          </h2>

          {testLaunch.workerTasks.map((task) => {
            const result = parseWorkerResult(task.resultJson)
            return (
              <div key={task.id} className="bg-white rounded-xl border border-stone-200 p-4 mb-3">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-stone-900 text-sm">
                      {WORKER_TASK_TYPE_LABELS[task.type] ?? task.type}
                    </p>
                    <p className="text-xs text-stone-400">{task.id}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_COLORS[task.status] ?? 'bg-stone-100 text-stone-600'}`}>
                    {STATUS_LABELS[task.status] ?? task.status}
                  </span>
                </div>

                {/* Result card */}
                {result && (
                  <div className="bg-stone-50 rounded-lg p-3 mb-3 text-sm">
                    {result.mode === 'dry_run_no_write' ? (
                      <div className="flex items-center gap-2 text-amber-700">
                        <span>🟡</span>
                        <span>Dry-run — tidak ada Meta Ads yang di-write. Mode aman.</span>
                      </div>
                    ) : result.ok ? (
                      <div className="flex items-center gap-2 text-green-700">
                        <span>✅</span>
                        <span>Campaign berhasil dibuat{result.campaignId ? ` (ID: ${result.campaignId})` : ''}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-700">
                        <span>❌</span>
                        <span>Gagal: {result.message ?? 'Unknown error'}</span>
                      </div>
                    )}

                    {/* Show campaign name + ad account from payload */}
                    {task.payloadJson && (() => {
                      try {
                        const payload = JSON.parse(task.payloadJson)
                        return (
                          <div className="mt-2 pt-2 border-t border-stone-200 grid grid-cols-2 gap-2 text-xs text-stone-600">
                            <div><span className="text-stone-400">Campaign:</span> {payload.name ?? '—'}</div>
                            <div><span className="text-stone-400">Objective:</span> {payload.objective ?? '—'}</div>
                            <div><span className="text-stone-400">Budget:</span> {payload.dailyBudget ? `Rp${Number(payload.dailyBudget).toLocaleString('id-ID')}` : '—'}</div>
                            <div><span className="text-stone-400">URL:</span> <span className="truncate block max-w-[200px]">{payload.destinationUrl ?? '—'}</span></div>
                            <div><span className="text-stone-400">Creative:</span> {payload.creatives?.length ?? 0}</div>
                            <div><span className="text-stone-400">Target:</span> {payload.audience ? `${payload.audience.ageMin}-${payload.audience.ageMax} th` : '—'}</div>
                            <div><span className="text-stone-400">Campaign ID:</span> {result?.campaignId ?? payload.campaignId ?? '—'}</div>
                            <div><span className="text-stone-400">Mode:</span> {result?.mode ?? 'unknown'}</div>
                          </div>
                        )
                      } catch { return null }
                    })()}
                  </div>
                )}

                {/* Meta info row */}
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-stone-400">
                  <span>Attempts: {task.attempts}/{task.maxAttempts}</span>
                  <span>Created: {formatDate(task.createdAt)}</span>
                  {task.completedAt && <span>Done: {formatDate(task.completedAt)}</span>}
                  {task.lastError && <span className="text-red-500">Error: {task.lastError}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Back Link ──────────────────────────────────────────────────── */}
      <div className="mt-8 pt-4 border-t border-stone-200">
        <Link href="/ads?tab=launch" className="text-sm text-stone-500 hover:text-stone-700">
          ← Kembali ke Test Launches
        </Link>
      </div>
    </div>
  )
}
