'use client'

import { useEffect, useState } from 'react'
import ClientTabs from '@/components/ClientTabs'
import WorkersPage from '../workers/page'
import DeadLettersPage from '../admin/dead-letters/page'
import ObservabilityPage from '../observability/page'
import AdminUsersPage from '../admin-users/page'
import ConnectionsTab from './ConnectionsTab'
import DocsPage from '../docs/page'

export default function SystemPage() {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialTab, setInitialTab] = useState<string>('connections')
  const [viewAsUser, setViewAsUser] = useState(false)

  useEffect(() => {
    setViewAsUser(sessionStorage.getItem('hsl_viewAsUser') === '1')
    const handler = (e: Event) => setViewAsUser((e as CustomEvent).detail as boolean)
    window.addEventListener('hsl_viewAsUser_change', handler)
    return () => window.removeEventListener('hsl_viewAsUser_change', handler)
  }, [])

  useEffect(() => {
    const urlTab = new URLSearchParams(window.location.search).get('tab')
    fetch('/api/admin/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const userRole = d?.user?.role ?? null
        const adminTabs = ['connections', 'workers', 'users', 'dead-letters', 'observability', 'docs']
        const userTabs = ['connections', 'workers', 'docs']
        const validTabs = userRole === 'admin' ? adminTabs : userTabs
        if (urlTab && validTabs.includes(urlTab)) setInitialTab(urlTab)
        setRole(userRole)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-stone-400 text-sm">
        Loading...
      </div>
    )
  }

  const isAdmin = role === 'admin' && !viewAsUser

  const userTabs = [
    { id: 'connections', label: 'Connections' },
    { id: 'workers', label: 'Workers' },
    { id: 'docs', label: 'Docs' },
  ]
  const adminTabs = [
    { id: 'connections', label: 'Connections' },
    { id: 'workers', label: 'Workers' },
    { id: 'users', label: 'Users' },
    { id: 'dead-letters', label: 'Dead Letters' },
    { id: 'observability', label: 'Observability' },
    { id: 'docs', label: 'Docs' },
  ]

  const tabs = isAdmin ? adminTabs : userTabs

  return (
    <ClientTabs
      tabs={tabs}
      initial={initialTab}
      basePath="/system"
      panels={{
        connections: <ConnectionsTab />,
        workers: <WorkersPage />,
        users: isAdmin ? <AdminUsersPage /> : <div className="text-sm text-stone-400 p-6">Admin only.</div>,
        'dead-letters': isAdmin ? <DeadLettersPage /> : <div className="text-sm text-stone-400 p-6">Admin only.</div>,
        observability: isAdmin ? <ObservabilityPage /> : <div className="text-sm text-stone-400 p-6">Admin only.</div>,
        docs: <DocsPage />,
      }}
    />
  )
}
