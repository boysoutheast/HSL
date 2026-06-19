'use client'

import { useEffect, useState } from 'react'
import ClientTabs from '@/components/ClientTabs'
import OverviewTab from './OverviewTab'
import UsersTab from './UsersTab'
import ConnectionsTab from './ConnectionsTab'
import DocsPage from '../docs/page'

export default function SystemPage() {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialTab, setInitialTab] = useState<string>('overview')
  const [viewAsUser, setViewAsUser] = useState(false)
  const [sysTab, setSysTab] = useState<string>('overview')

  useEffect(() => {
    // Listen for tab switch from Overview alert
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail as string
      if (tab) setSysTab(tab)
    }
    window.addEventListener('hsl_system_tab', handler)
    return () => window.removeEventListener('hsl_system_tab', handler)
  }, [])

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
        const adminTabs = ['overview', 'users', 'connections']
        const userTabs = ['connections']
        const validTabs = userRole === 'admin' ? adminTabs : userTabs
        if (urlTab && validTabs.includes(urlTab)) setInitialTab(urlTab)
        setRole(userRole)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-stone-400 text-sm">Loading...</div>
  }

  const isAdmin = role === 'admin' && !viewAsUser

  const userTabs = [
    { id: 'connections', label: 'Connections' },
  ]
  const adminTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users' },
    { id: 'connections', label: 'Connections' },
  ]

  const tabs = isAdmin ? adminTabs : userTabs
  const activeTab = sysTab !== 'overview' && tabs.some(t => t.id === sysTab) ? sysTab : initialTab

  return (
    <ClientTabs
      tabs={tabs}
      initial={activeTab}
      basePath="/system"
      panels={{
        overview: isAdmin ? <OverviewTab /> : <div className="text-sm text-stone-400 p-6">Admin only.</div>,
        users: isAdmin ? <UsersTab /> : <div className="text-sm text-stone-400 p-6">Admin only.</div>,
        connections: <ConnectionsTab />,
      }}
    />
  )
}
