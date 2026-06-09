'use client'

import { useEffect, useState } from 'react'
import PageInfo from '@/components/ui/PageInfo'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'

interface AutoReplyRule {
  id: string
  name: string
  triggerType: string
  triggerValue: string
  responseType: string
  responseValue: string
  isActive: boolean
  createdAt: string
  metaPage: { pageName: string; pageId: string } | null
  metaAccount: { id: string; name: string } | null
}

interface AutoReplyResponse {
  rules: AutoReplyRule[]
  total: number
  page: number
  pages: number
}

export default function AutoReplyPage() {
  const [data, setData] = useState<AutoReplyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('')
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; ruleId: string | null }>({ open: false, ruleId: null })
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchRules = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/auto-reply?limit=100')
      if (!res.ok) throw new Error('Failed to fetch rules')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRules()
  }, [])

  const handleToggle = async (rule: AutoReplyRule) => {
    setToggleLoading(rule.id)
    try {
      const res = await fetch(`/api/admin/auto-reply/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive }),
      })
      if (!res.ok) throw new Error('Failed to toggle')
      fetchRules()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Toggle failed')
    } finally {
      setToggleLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.ruleId) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/auto-reply/${deleteModal.ruleId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setDeleteModal({ open: false, ruleId: null })
      fetchRules()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setActionLoading(false)
    }
  }

  const filteredRules = data?.rules.filter(r => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (
      r.name.toLowerCase().includes(q) ||
      r.triggerValue.toLowerCase().includes(q) ||
      r.metaPage?.pageName.toLowerCase().includes(q)
    )
  }) ?? []

  const activeCount = data?.rules.filter(r => r.isActive).length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Auto Reply Rules</h1>
          <p className="section-sub">Set AI-powered automatic replies triggered by comment content or sentiment.</p>
        </div>
        <a href="/community/auto-reply/new" className="btn-primary">
          + New Rule
        </a>
      </div>

      <PageInfo
        purpose="Create rules that automatically reply to comments matching specific keywords, phrases, or sentiment patterns. Uses Hermes AI to generate smart, brand-appropriate responses."
        inputs={['Rule name', 'Trigger (keyword/phrase/sentiment)', 'Reply text or AI generation', 'Platform (Facebook/Instagram/Both)', 'CEP/character to use']}
        wiring={[
          { label: 'CEP', desc: 'Response tone and style — pick which character/CEP generates the reply' },
          { label: 'AI Model', desc: 'GPT-4o mini for fast auto-replies, GPT-4o for complex queries' },
          { label: 'Fallback', desc: 'If no rule matches, flag as pending for manual review' },
        ]}
      />

      {data && (
        <div className="flex gap-4 text-sm">
          <span className="badge-active">Active: {activeCount}</span>
          <span className="badge-inactive">Inactive: {(data.rules.length - activeCount)}</span>
          <span className="text-stone-500">Total: {data.total}</span>
        </div>
      )}

      <div className="card">
        <div className="px-4 py-3 border-b border-stone-200 flex gap-3 items-center">
          <input
            type="text"
            placeholder="Filter rules..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="input-field text-sm flex-1"
          />
          <button onClick={fetchRules} className="btn-secondary text-sm" disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-violet-600 border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-red-600">{error}</div>
        ) : (
          <Table
            headers={['Rule Name', 'Trigger', 'Reply Preview', 'Platform', 'Status', 'Actions']}
            empty="No auto-reply rules found."
          >
            {filteredRules.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <a href={`/community/auto-reply/${r.id}`} className="text-violet-700 hover:underline font-medium">
                    {r.name}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded max-w-[200px] truncate block">
                    {r.triggerType}:{r.triggerValue}
                  </code>
                </td>
                <td className="px-4 py-3">
                  <span className="text-stone-500 text-sm truncate max-w-[250px] block">
                    {r.responseValue.substring(0, 50)}...
                  </span>
                </td>
                <td className="px-4 py-3 text-stone-600">{r.metaPage?.pageName ?? 'All Pages'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.isActive ? 'active' : 'inactive'} />
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button
                    onClick={() => handleToggle(r)}
                    disabled={toggleLoading === r.id}
                    className={`text-sm font-medium disabled:opacity-50 ${
                      r.isActive ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'
                    }`}
                  >
                    {toggleLoading === r.id ? '...' : r.isActive ? 'Pause' : 'Activate'}
                  </button>
                  <a href={`/community/auto-reply/${r.id}`} className="text-violet-600 hover:text-violet-800 text-sm">
                    Edit
                  </a>
                  <button
                    onClick={() => setDeleteModal({ open: true, ruleId: r.id })}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, ruleId: null })}
        title="Delete Rule"
      >
        <p className="text-stone-600 mb-4">Are you sure you want to delete this auto-reply rule? This action cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteModal({ open: false, ruleId: null })}
            className="btn-secondary"
            disabled={actionLoading}
          >
            Cancel
          </button>
          <button onClick={handleDelete} className="btn-error" disabled={actionLoading}>
            {actionLoading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
