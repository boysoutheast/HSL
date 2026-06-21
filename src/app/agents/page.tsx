'use client'

import { useEffect, useState, useCallback } from 'react'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import Table from '@/components/ui/Table'
import PageInfo from '@/components/ui/PageInfo'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface Agent {
  id: string
  name: string
  status: string
  notes: string | null
  createdAt: string
  _count?: { assignments: number; contentLogs: number }
  lastApiCallAt?: string | null
}

type AssignableType = 'InstagramAccount' | 'Character' | 'Topic' | 'Product' | 'Cep'

interface Assignable {
  id: string
  label: string
  sublabel?: string
}

interface Assignment {
  id: string
  hermesAgentId: string
  assignableType: string
  assignableId: string
  status: string
}

const ASSIGN_TABS: { label: string; type: AssignableType; endpoint: string }[] = [
  { label: 'Account', type: 'InstagramAccount', endpoint: '/api/admin/accounts' },
  { label: 'Character', type: 'Character', endpoint: '/api/admin/characters' },
  { label: 'Topic', type: 'Topic', endpoint: '/api/admin/topics' },
  { label: 'Product', type: 'Product', endpoint: '/api/admin/products' },
  { label: 'CEP', type: 'Cep', endpoint: '/api/admin/ceps' },
]

// Convert frontend PascalCase type → API snake_case
function toApiType(type: AssignableType): string {
  const map: Record<AssignableType, string> = {
    InstagramAccount: 'instagram_account',
    Character: 'character',
    Topic: 'topic',
    Product: 'product',
    Cep: 'cep',
  }
  return map[type]
}

function mapToAssignable(type: AssignableType, items: Record<string, unknown>[]): Assignable[] {
  return items.map((item) => {
    const id = item.id as string
    switch (type) {
      case 'InstagramAccount':
        return { id, label: `@${item.username as string}`, sublabel: (item.accountName as string) ?? undefined }
      case 'Character':
        return { id, label: item.name as string, sublabel: (item.instagramAccount as { username: string })?.username }
      case 'Topic':
        return { id, label: item.name as string, sublabel: (item.character as { name: string })?.name }
      case 'Product':
        return { id, label: item.name as string, sublabel: (item.mainBenefit as string) ?? undefined }
      case 'Cep':
        return {
          id,
          label: ((item.cepText as string) ?? '').substring(0, 80) + ((item.cepText as string)?.length > 80 ? '…' : ''),
          sublabel: (item.topic as { name: string })?.name,
        }
    }
  })
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [newApiKey, setNewApiKey] = useState('')
  const [newAgentName, setNewAgentName] = useState('')
  const [newAgentNotes, setNewAgentNotes] = useState('')
  const [creating, setCreating] = useState(false)
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [regenLoading, setRegenLoading] = useState<string | null>(null)
  const [regenKey, setRegenKey] = useState<{ agentId: string; agentName: string; key: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmRegenAgent, setConfirmRegenAgent] = useState<Agent | null>(null)

  // Assignments state
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [activeAssignTab, setActiveAssignTab] = useState<AssignableType>('InstagramAccount')
  const [assignItems, setAssignItems] = useState<Assignable[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loadingAssign, setLoadingAssign] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/hermes-agents', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const list = data.agents ?? data
      setAgents(list)
      if (list.length > 0 && !selectedAgentId) setSelectedAgentId(list[0].id)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [selectedAgentId])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  // Load assignable items for current tab
  const loadAssignItems = useCallback(async () => {
    const tab = ASSIGN_TABS.find((t) => t.type === activeAssignTab)
    if (!tab) return
    setLoadingAssign(true)
    try {
      const res = await fetch(tab.endpoint, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const raw = await res.json()
      // Handle both wrapped and unwrapped responses
      const items: Record<string, unknown>[] =
        Array.isArray(raw) ? raw :
        raw.accounts ?? raw.characters ?? raw.topics ?? raw.products ?? raw.ceps ?? []
      setAssignItems(mapToAssignable(activeAssignTab, items))
    } catch {
      setAssignItems([])
    } finally {
      setLoadingAssign(false)
    }
  }, [activeAssignTab])

  const loadAssignments = useCallback(async () => {
    if (!selectedAgentId) return
    try {
      const res = await fetch(`/api/admin/assignments?hermesAgentId=${selectedAgentId}`, { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      // API returns { assignments: [...] }
      setAssignments(data.assignments ?? [])
    } catch {
      setAssignments([])
    }
  }, [selectedAgentId])

  useEffect(() => { loadAssignItems() }, [loadAssignItems])
  useEffect(() => { loadAssignments() }, [loadAssignments])

  // Sync checked from assignments — compare using API snake_case type
  useEffect(() => {
    const apiType = toApiType(activeAssignTab)
    const assigned = new Set(
      assignments
        .filter((a) => a.assignableType === apiType && a.hermesAgentId === selectedAgentId && a.status === 'active')
        .map((a) => a.assignableId)
    )
    setChecked(assigned)
  }, [assignments, activeAssignTab, selectedAgentId])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAgentName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/admin/hermes-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAgentName.trim(), notes: newAgentNotes.trim() || undefined }),
      })
      if (!res.ok) throw new Error('Failed to create agent')
      const data = await res.json()
      setNewApiKey(data.apiKey ?? data.rawApiKey ?? '')
      setShowAddModal(false)
      setNewAgentName('')
      setNewAgentNotes('')
      setShowKeyModal(true)
      await fetchAgents()
    } catch {
      alert('Failed to create agent. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const toggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === 'active' ? 'inactive' : 'active'
    setToggleLoading(agent.id)
    try {
      const res = await fetch(`/api/admin/hermes-agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, status: newStatus } : a)))
    } catch {
      alert('Failed to update agent status.')
    } finally {
      setToggleLoading(null)
    }
  }

  const handleRegenerateKey = async (agent: Agent) => {
    setConfirmRegenAgent(agent)
  }

  const handleRegenerateKeyConfirmed = async (agent: Agent) => {
    setConfirmRegenAgent(null)
    setRegenLoading(agent.id)
    try {
      const res = await fetch(`/api/admin/hermes-agents/${agent.id}/regenerate-key`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setRegenKey({ agentId: agent.id, agentName: agent.name, key: data.apiKey })
      setCopied(false)
    } catch (err) {
      alert('Gagal regenerate key: ' + String(err))
    } finally {
      setRegenLoading(null)
    }
  }

  const handleToggleCheck = (itemId: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const handleRemoveAssignment = async (itemId: string) => {
    if (!selectedAgentId) return
    try {
      const apiType = toApiType(activeAssignTab)
      const params = new URLSearchParams({ hermesAgentId: selectedAgentId, assignableType: apiType, assignableId: itemId })
      const res = await fetch(`/api/admin/assignments?${params}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      setChecked((prev) => { const next = new Set(prev); next.delete(itemId); return next })
      await loadAssignments()
    } catch {
      alert('Failed to remove assignment.')
    }
  }

  const handleSaveAssignment = async () => {
    if (!selectedAgentId) return
    setSaving(true)
    try {
      const apiType = toApiType(activeAssignTab)
      // Current active assignments for this agent + type
      const currentAssigned = new Set(
        assignments
          .filter((a) => a.assignableType === apiType && a.hermesAgentId === selectedAgentId && a.status === 'active')
          .map((a) => a.assignableId)
      )
      // POST each newly-checked item (upsert on API side — safe to call on existing)
      const toAdd = [...checked].filter((id) => !currentAssigned.has(id))
      // DELETE each unchecked item
      const toRemove = [...currentAssigned].filter((id) => !checked.has(id))

      await Promise.all([
        ...toAdd.map((assignableId) =>
          fetch('/api/admin/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ hermesAgentId: selectedAgentId, assignableType: apiType, assignableId: assignableId }),
          })
        ),
        ...toRemove.map((assignableId) => {
          const params = new URLSearchParams({ hermesAgentId: selectedAgentId, assignableType: apiType, assignableId: assignableId })
          return fetch(`/api/admin/assignments?${params}`, { method: 'DELETE', credentials: 'include' })
        }),
      ])
      await loadAssignments()
      alert('Assignments saved.')
    } catch {
      alert('Failed to save assignments.')
    } finally {
      setSaving(false)
    }
  }

  const activeCount = agents.filter((a) => a.status === 'active').length
  const selectedAgent = agents.find((a) => a.id === selectedAgentId)

  return (
    <div>
      {/* ── Agents Table ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">AI Buddy Agents</h1>
          <p className="text-sm text-stone-500 mt-0.5">{agents.length} total · {activeCount} active</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">+ Add Agent</button>
      </div>

      <PageInfo
        purpose="Kelola AI agent AI Buddy dan assign data yang boleh mereka akses."
        inputs={['Nama agent (misal: Agent 1)', 'Notes (opsional)']}
        wiring={[
          { label: '→ Assignment', desc: 'agent harus di-assign ke akun/character/topic/produk sebelum bisa kerja' },
          { label: '→ Hermes API', desc: 'semua /api/hermes/* endpoint divalidasi pakai API key agent ini' },
          { label: '→ Content Log', desc: 'setiap generate/posting dicatat dengan hermes_agent_id' },
        ]}
      />

      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">Loading agents...</div>
      ) : (
        <Table
          headers={['Name', 'Status', 'Assignments', 'Content Logs', 'Created', 'Notes', 'Actions']}
          empty="No AI Buddy agents found."
        >
          {agents.map((agent) => (
            <tr
              key={agent.id}
              className={`hover:bg-stone-50 transition-colors cursor-pointer ${selectedAgentId === agent.id ? 'bg-violet-50' : ''}`}
              onClick={() => setSelectedAgentId(agent.id)}
            >
              <td className="px-4 py-3">
                <p className="font-medium text-stone-900">{agent.name}</p>
                <p className="text-xs text-stone-400 font-mono mt-0.5">{agent.id.substring(0, 12)}...</p>
              </td>
              <td className="px-4 py-3"><StatusBadge status={agent.status} /></td>
              <td className="px-4 py-3 text-stone-600">{agent._count?.assignments ?? 0}</td>
              <td className="px-4 py-3 text-stone-600">{agent._count?.contentLogs ?? 0}</td>
              <td className="px-4 py-3 text-stone-400 text-xs whitespace-nowrap">
                {new Date(agent.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </td>
              <td className="px-4 py-3 text-stone-500 max-w-[200px]">
                <p className="truncate">{agent.notes ?? '—'}</p>
              </td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleStatus(agent)}
                    disabled={toggleLoading === agent.id}
                    className={agent.status === 'active' ? 'btn-danger btn-sm' : 'btn-success btn-sm'}
                  >
                    {toggleLoading === agent.id ? '...' : agent.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleRegenerateKey(agent)}
                    disabled={regenLoading === agent.id}
                    className="btn-warning btn-sm"
                    title="Regenerate API Key"
                  >
                    {regenLoading === agent.id ? '...' : '🔄 Key'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* ── Assignments Section ── */}
      <div className="mt-10">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-stone-900">Assignments</h2>
          <p className="text-sm text-stone-500 mt-0.5">Assign data yang boleh diakses agent yang dipilih. Klik baris agent di atas untuk memilih.</p>
        </div>

        {!selectedAgentId ? (
          <div className="flex items-center justify-center h-32 text-stone-400 text-sm bg-white border border-stone-200 rounded-xl">
            Pilih agent dari tabel di atas untuk manage assignment.
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-xl">
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
              <div>
                <p className="font-semibold text-stone-900">{selectedAgent?.name}</p>
                <p className="text-xs text-stone-500 mt-0.5">{checked.size} item{checked.size !== 1 ? 's' : ''} selected in current tab</p>
              </div>
              <button onClick={handleSaveAssignment} disabled={saving} className="btn-success">
                {saving ? 'Saving...' : 'Save Assignment'}
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-stone-200 px-2 pt-1">
              {ASSIGN_TABS.map(({ label, type }) => (
                <button
                  key={type}
                  onClick={() => setActiveAssignTab(type)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeAssignTab === type
                      ? 'border-violet-600 text-violet-600'
                      : 'border-transparent text-stone-500 hover:text-stone-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Checklist */}
            <div className="p-4">
              {loadingAssign ? (
                <div className="flex items-center justify-center h-32 text-stone-400 text-sm">Loading...</div>
              ) : assignItems.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-stone-400 text-sm">No items found.</div>
              ) : (
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {assignItems.map((item) => {
                    const isChecked = checked.has(item.id)
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${isChecked ? 'bg-violet-50' : 'hover:bg-stone-50'}`}
                      >
                        <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleCheck(item.id)}
                            className="w-4 h-4 text-violet-600 rounded border-stone-300 focus:ring-violet-500 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${isChecked ? 'text-violet-900' : 'text-stone-800'}`}>{item.label}</p>
                            {item.sublabel && <p className="text-xs text-stone-400 truncate">{item.sublabel}</p>}
                          </div>
                        </label>
                        {isChecked && (
                          <button
                            onClick={() => handleRemoveAssignment(item.id)}
                            className="btn-danger btn-sm flex-shrink-0 ml-2"
                            title="Remove assignment"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Agent Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add AI Buddy Agent">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Agent Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={newAgentName}
              onChange={(e) => setNewAgentName(e.target.value)}
              placeholder="e.g. hermes-agent-01"
              required
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
            <textarea
              value={newAgentNotes}
              onChange={(e) => setNewAgentNotes(e.target.value)}
              placeholder="Optional notes about this agent..."
              rows={3}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={creating || !newAgentName.trim()} className="btn-primary">
              {creating ? 'Creating...' : 'Create Agent'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Regenerate Key Modal */}
      {regenKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold text-stone-900">API Key Baru — {regenKey.agentName}</h3>
            <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-yellow-800">
                <strong>Simpan key ini sekarang.</strong> Key lama sudah tidak berlaku. Key baru tidak akan ditampilkan lagi.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">New API Key</label>
              <code className="block bg-gray-900 text-green-400 text-sm px-3 py-3 rounded-lg font-mono break-all select-all">
                {regenKey.key}
              </code>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(regenKey.key)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="btn-primary flex-1"
              >
                {copied ? '✓ Copied!' : 'Copy Key'}
              </button>
              <button
                onClick={() => { setRegenKey(null); setCopied(false) }}
                className="btn-ghost flex-1"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Key Confirm */}
      <ConfirmDialog
        open={!!confirmRegenAgent}
        title="Regenerate API Key"
        body={
          <>
            Regenerate API key untuk <strong>&ldquo;{confirmRegenAgent?.name}&rdquo;</strong>?
            <br /><br />
            Key lama akan langsung <strong>tidak berlaku</strong>.
          </>
        }
        confirmLabel="Regenerate"
        danger
        loading={regenLoading === confirmRegenAgent?.id}
        onConfirm={() => confirmRegenAgent && handleRegenerateKeyConfirmed(confirmRegenAgent)}
        onCancel={() => setConfirmRegenAgent(null)}
      />

      {/* API Key Modal */}
      <Modal open={showKeyModal} onClose={() => { setShowKeyModal(false); setNewApiKey('') }} title="Agent Created — Save Your API Key">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-yellow-800">
              <strong>Save this API key now.</strong> It will never be shown again. If lost, you must create a new agent.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">API Key</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 block bg-gray-900 text-green-400 text-sm px-3 py-3 rounded-lg font-mono break-all">{newApiKey}</code>
              <button onClick={() => navigator.clipboard.writeText(newApiKey)} className="btn-info" title="Copy to clipboard">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Key
              </button>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={() => { setShowKeyModal(false); setNewApiKey('') }} className="btn-success">
              I&apos;ve saved the key
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
