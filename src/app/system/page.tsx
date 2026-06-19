'use client'

import { useEffect, useState } from 'react'
import ClientTabs from '@/components/ClientTabs'
import AdminUsersPage from '../admin-users/page'
import ConnectionsTab from './ConnectionsTab'
import DocsPage from '../docs/page'
import MetaConnectionsPage from '../meta-connections/page'
import HashCheckerTab from './HashCheckerTab'

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
        const adminTabs = ['connections', 'users', 'docs', 'meta', 'hash-checker']
        const userTabs = ['connections', 'docs']
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
    { id: 'docs', label: 'Docs' },
  ]
  const adminTabs = [
    { id: 'connections', label: 'Connections' },
    { id: 'users', label: 'Users' },
    { id: 'docs', label: 'Docs' },
    { id: 'meta', label: 'Meta' },
    { id: 'hash-checker', label: 'Hash Checker' },
  ]

  const tabs = isAdmin ? adminTabs : userTabs

  return (
    <ClientTabs
      tabs={tabs}
      initial={initialTab}
      basePath="/system"
      panels={{
        connections: <ConnectionsTab />,
        users: isAdmin ? <AdminUsersPage /> : <div className="text-sm text-stone-400 p-6">Admin only.</div>,
        docs: <DocsPage />,
        meta: isAdmin ? <MetaConnectionsPage /> : <div className="text-sm text-stone-400 p-6">Admin only.</div>,
        'hash-checker': isAdmin ? <HashCheckerTab /> : <div className="text-sm text-stone-400 p-6">Admin only.</div>,
      }}
    />
  )
}
