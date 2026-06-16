'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import StatusBadge from '@/components/ui/StatusBadge'
import Table from '@/components/ui/Table'
import PageInfo from '@/components/ui/PageInfo'
import Modal from '@/components/ui/Modal'

interface RequestedBy {
  id: string
  name: string | null
  email: string
}

interface ReviewedBy {
  id: string
  name: string | null
  email: string
}

interface TestLaunchSummary {
  id: string
  name: string
  status: string
  objective: string
  dailyBudget: string
  launchMode: string
  metaAccountId: string
  productId: string | null
}

interface ApprovalRequest {
  id: string
  testLaunchId: string
  requestedById: string
  reviewedById: string | null
  actionType: string
  status: string
  requestNote: string | null
  reviewNote: string | null
  createdAt: string
  reviewedAt: string | null
  testLaunch: TestLaunchSummary
  requestedBy: RequestedBy
  reviewedBy: ReviewedBy | null
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  pages: number
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  create_campaign: 'Buat Campaign',
  duplicate_adset: 'Duplikat Adset',
  increase_budget: 'Naikkan Budget',
  pause_ad: 'Jeda Iklan',
}

const STATUS = ['all', 'pending', 'approved', 'rejected'] as const
type StatusTab = typeof STATUS[number]

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const ACTION_TO_STATUS: Record<string, string> = {
  approve: 'approved',
  reject: 'rejected',
}

function ApprovalRequestsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = (searchParams.get('tab') ?? 'all') as StatusTab

  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<StatusTab>(tabParam)
  const [currentPage, setCurrentPage] = useState(1)

  // Review modal state
  const [reviewModal, setReviewModal] = useState<{ open: boolean; request: ApprovalRequest | null; action: 'approve' | 'reject' | null }>({
    open: false,
    request: null,
    action: null,
  })
  const [reviewNote, setReviewNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fetchRequests = useCallback(async (page: number, status: StatusTab = 'all') => {
    setLoading(true)
    setFetchError(null)
    try {
      const statusParam = status !== 'all' ? `&status=${status}` : ''
      const res = await fetch(`/api/admin/approval-requests?page=${page}&limit=20${statusParam}`, { credentials: 'include' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Gagal memuat (${res.status})`)
      }
      const data = await res.json()
      setRequests(data.requests ?? [])
      setPagination(data.pagination ?? { page, limit: 20, total: 0, pages: 0 })
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchRequests(currentPage, activeTab)
  }, [currentPage, activeTab, fetchRequests])

  const handleTabChange = (tab: StatusTab) => {
    setActiveTab(tab)
    setCurrentPage(1)
    router.replace(`/approval-requests${tab === 'all' ? '' : `?tab=${tab}`}`, { scroll: false })
  }

  const openReview = (request: ApprovalRequest, action: 'approve' | 'reject') => {
    setReviewModal({ open: true, request, action })
    setReviewNote('')
    setSubmitError(null)
  }

  const closeReview = () => {
    setReviewModal({ open: false, request: null, action: null })
    setReviewNote('')
    setSubmitError(null)
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewModal.request) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/admin/approval-requests/${reviewModal.request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: ACTION_TO_STATUS[reviewModal.action!],
          reviewNote: reviewNote.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Server error (${res.status})`)
      }
      closeReview()
      await fetchRequests(currentPage)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredRequests = requests

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Approval Requests</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          {loading ? '...' : `${pagination.total} request${pagination.total !== 1 ? 's' : ''} total`}
        </p>
      </div>

      <PageInfo
        purpose="Queue persetujuan untuk Test Launch. Admin bisa approve atau reject setiap request."
        wiring={[
          { label: '→ Test Launch', desc: 'klik nama untuk lihat detail launch' },
          { label: '→ Worker Task', desc: 'dibuat otomatis saat approval disetujui' },
        ]}
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-5 bg-stone-100 rounded-lg p-1 w-fit">
        {[
          { key: 'all', label: 'Semua' },
          { key: 'pending', label: 'Pending' },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key as StatusTab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {label}
            {activeTab === key && pagination.total > 0 && (
              <span className="ml-1.5 text-xs text-violet-600">{pagination.total}</span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {fetchError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
          ⚠️ {fetchError}
          <button onClick={() => fetchRequests(currentPage, activeTab)} className="ml-auto text-xs underline text-red-600">Coba lagi</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">Memuat...</div>
      ) : (
        <Table
          headers={['Requester', 'Test Launch', 'Action', 'Tgl Request', 'Status', 'Actions']}
          empty={`Tidak ada request dengan status "${activeTab}".`}
        >
          {filteredRequests.map((req) => (
            <tr key={req.id} className="hover:bg-stone-50 transition-colors">
              <td className="px-4 py-3">
                <div className="text-sm">
                  <p className="font-medium text-stone-900">{req.requestedBy.name ?? req.requestedBy.email}</p>
                  <p className="text-stone-400 text-xs">{req.requestedBy.email}</p>
                </div>
              </td>
              <td className="px-4 py-3">
                <Link href={`/test-launches/${req.testLaunch.id}`} className="font-medium text-violet-700 hover:underline">
                  {req.testLaunch.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-stone-700 text-sm">
                {ACTION_TYPE_LABELS[req.actionType] ?? req.actionType}
              </td>
              <td className="px-4 py-3 text-stone-500 text-sm whitespace-nowrap">
                {formatDate(req.createdAt)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={req.status} />
              </td>
              <td className="px-4 py-3">
                {req.status === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openReview(req, 'approve')}
                      className="btn-success btn-sm"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => openReview(req, 'reject')}
                      className="btn-danger btn-sm"
                    >
                      ✕ Reject
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-stone-400">
                    {req.reviewedBy ? (
                      <span>
                        {req.reviewedBy.name ?? req.reviewedBy.email}{' '}
                        <span className="text-gray-300">·</span>{' '}
                        {formatDate(req.reviewedAt)}
                      </span>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Pagination */}
      {!loading && pagination.pages > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-stone-500">
            Halaman {pagination.page} dari {pagination.pages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="btn-ghost btn-sm"
            >
              ← Prev
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={pagination.page >= pagination.pages}
              className="btn-ghost btn-sm"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Approve / Reject Modal */}
      <Modal
        open={reviewModal.open}
        onClose={closeReview}
        title={reviewModal.action === 'approve' ? 'Approve Request' : 'Reject Request'}
      >
        {reviewModal.request && (
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div className="bg-stone-50 rounded-lg p-3 text-sm space-y-1">
              <p>
                <span className="text-stone-500">Test Launch:</span>{' '}
                <Link href={`/test-launches/${reviewModal.request.testLaunch.id}`} className="font-medium text-violet-700 hover:underline">
                  {reviewModal.request.testLaunch.name}
                </Link>
              </p>
              <p>
                <span className="text-stone-500">Action:</span>{' '}
                <span className="font-medium">
                  {ACTION_TYPE_LABELS[reviewModal.request.actionType] ?? reviewModal.request.actionType}
                </span>
              </p>
              <p>
                <span className="text-stone-500">Requested by:</span>{' '}
                <span>{reviewModal.request.requestedBy.name ?? reviewModal.request.requestedBy.email}</span>
              </p>
              {reviewModal.request.requestNote && (
                <p>
                  <span className="text-stone-500">Catatan:</span>{' '}
                  <span className="text-stone-700">{reviewModal.request.requestNote}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Catatan Review{' '}
                <span className="text-stone-400 font-normal">(opsional)</span>
              </label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={
                  reviewModal.action === 'approve'
                    ? 'Catatan saat menyetujui...'
                    : 'Alasan penolakan...'
                }
                rows={3}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                ⚠️ {submitError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeReview} className="btn-ghost">
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={reviewModal.action === 'approve' ? 'btn-success' : 'btn-danger'}
              >
                {submitting
                  ? 'Memproses...'
                  : reviewModal.action === 'approve'
                  ? '✓ Approve'
                  : '✕ Reject'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

export default function ApprovalRequestsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-48 text-stone-400 text-sm">Memuat...</div>}>
      <ApprovalRequestsInner />
    </Suspense>
  )
}
