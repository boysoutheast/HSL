'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PageInfo from '@/components/ui/PageInfo'
import { HelpHint } from '@/components/ui/HelpHint'

interface MetaAdAccount {
  id: string
  adAccountId: string
  adAccountName: string | null
  enabledForAutomation?: boolean
  business: { id: string; businessName: string } | null
}

interface MetaCampaign {
  metaCampaignId: string
  name: string
  status: string
  dailyBudget: number
  objective: string
  adsetCount: number
  alreadyImported: boolean
}

function fmtCurrency(n: number) {
  return `Rp ${n.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '🟢 Active',
  PAUSED: '🟡 Paused',
  DELETED: '🔴 Deleted',
  ARCHIVED: '⚪ Archived',
}

export default function ImportCampaignPage() {
  const router = useRouter()
  const [adAccounts, setAdAccounts] = useState<MetaAdAccount[]>([])
  const [selectedAdAccountId, setSelectedAdAccountId] = useState('')
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<MetaCampaign | null>(null)
  const [internalName, setInternalName] = useState('')
  const [scanInterval, setScanInterval] = useState(15)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1) // 1 = pick ad account, 2 = pick campaign

  // Fetch ad accounts
  useEffect(() => {
    fetch('/api/admin/meta-accounts', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        const accounts: MetaAdAccount[] = []
        for (const ma of data.metaAccounts ?? []) {
          for (const aa of ma.adAccounts ?? []) {
            accounts.push({
              id: aa.id,
              adAccountId: aa.adAccountId,
              adAccountName: aa.adAccountName ?? `act_${aa.adAccountId}`,
              enabledForAutomation: aa.enabledForAutomation ?? true,
              business: aa.business ?? null,
            })
          }
        }
        setAdAccounts(accounts)
      })
      .catch(() => {})
  }, [])

  // Fetch campaigns when ad account changes
  const fetchCampaigns = useCallback(async () => {
    if (!selectedAdAccountId) return
    setCampaignsLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/meta-campaigns?metaAdAccountId=${selectedAdAccountId}`, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to fetch campaigns')
      }
      const data = await res.json()
      setCampaigns(data.campaigns ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCampaignsLoading(false)
    }
  }, [selectedAdAccountId])

  useEffect(() => {
    if (selectedAdAccountId) fetchCampaigns()
  }, [selectedAdAccountId, fetchCampaigns])

  // Select a campaign
  const handleSelectCampaign = (campaign: MetaCampaign) => {
    if (campaign.alreadyImported) return
    setSelectedCampaign(campaign)
    setInternalName(campaign.name)
    setStep(2)
  }

  // Import
  const handleImport = async () => {
    if (!selectedCampaign) return
    setImporting(true)
    setError('')
    try {
      const res = await fetch('/api/admin/campaign-sessions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          metaAdAccountId: selectedAdAccountId,
          metaCampaignId: selectedCampaign.metaCampaignId,
          name: internalName,
          monitorIntervalMinutes: scanInterval,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      router.push(`/campaign-monitor/${data.session.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setImporting(false)
    }
  }

  const cancelImport = () => {
    setSelectedCampaign(null)
    setStep(1)
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/ads?tab=monitor" className="text-stone-400 hover:text-stone-600 text-sm">← Campaign Monitor</Link>
      </div>

      <h1 className="text-2xl font-bold text-stone-900 mb-1">Import Meta Campaign</h1>
      <p className="text-sm text-stone-500 mb-6">
        Bring an existing Meta Ads campaign under AI Buddy management with automation rules.
      </p>

      <PageInfo
        purpose="Select a Meta campaign to import. Imported campaigns start with automation disabled — attach rules after import."
        wiring={[
          { label: '→ Pick Ad Account', desc: 'choose the Meta ad account with the campaign' },
          { label: '→ Pick Campaign', desc: 'select which campaign to manage' },
          { label: '→ Set Name & Interval', desc: 'internal name and how often to scan' },
          { label: '→ Attach Rules', desc: 'after import, add automation rules in campaign detail' },
        ]}
      />

      {/* Step 1: Pick Ad Account + Campaign */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-4">
        <h2 className="text-sm font-bold text-stone-900 mb-1">Step 1: Pick Ad Account <HelpHint k="im.adAccount" /></h2>
        <p className="text-xs text-stone-500 mb-4">Choose which Meta ad account contains the campaign.</p>

        <select
          value={selectedAdAccountId}
          onChange={(e) => { setSelectedAdAccountId(e.target.value); setSelectedCampaign(null); setStep(1) }}
          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">— Select Ad Account —</option>
          {adAccounts.map((aa) => (
            <option key={aa.id} value={aa.id}>
              {aa.adAccountName} {aa.business ? `(${aa.business.businessName})` : ''}
              {aa.enabledForAutomation === false ? ' ⛔ Automation OFF' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Campaign list */}
      {selectedAdAccountId && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-4">
          <h2 className="text-sm font-bold text-stone-900 mb-1">
            Step 2: Pick Campaign <HelpHint k="im.pickCampaign" />
          </h2>
          <p className="text-xs text-stone-500 mb-4">
            {campaignsLoading ? 'Loading campaigns from Meta...' :
             campaigns.length === 0 ? 'No campaigns found for this ad account.' :
             `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} found`}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          {campaignsLoading ? (
            <div className="flex items-center justify-center h-32 text-stone-400 text-sm">Loading...</div>
          ) : campaigns.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {campaigns.map((c) => (
                <button
                  key={c.metaCampaignId}
                  onClick={() => handleSelectCampaign(c)}
                  disabled={c.alreadyImported}
                  className={`w-full text-left flex items-center justify-between gap-4 px-4 py-3 rounded-lg border transition-colors ${
                    c.alreadyImported
                      ? 'border-stone-200 bg-stone-50 opacity-60 cursor-not-allowed'
                      : selectedCampaign?.metaCampaignId === c.metaCampaignId
                      ? 'border-violet-400 bg-violet-50'
                      : 'border-stone-200 hover:border-violet-300 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-stone-900 truncate">{c.name}</p>
                      <span className="text-xs text-stone-500">{c.objective}</span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {STATUS_LABELS[c.status] ?? c.status} &bull; {fmtCurrency(c.dailyBudget)}/day &bull; {c.adsetCount} ad set{c.adsetCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {c.alreadyImported ? (
                    <span className="text-xs bg-stone-200 text-stone-500 px-2 py-0.5 rounded-full whitespace-nowrap">Already managed</span>
                  ) : (
                    <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full whitespace-nowrap">Select</span>
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Step 2: Settings */}
      {step === 2 && selectedCampaign && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-4">
          <h2 className="text-sm font-bold text-stone-900 mb-1">Campaign Settings</h2>
          <p className="text-xs text-stone-500 mb-4">Configure how this campaign will be managed in AI Buddy.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Internal Name</label>
              <input
                type="text"
                value={internalName}
                onChange={(e) => setInternalName(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Scan Interval</label>
              <select
                value={scanInterval}
                onChange={(e) => setScanInterval(Number(e.target.value))}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value={5}>Every 5 minutes</option>
                <option value={10}>Every 10 minutes</option>
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every 60 minutes</option>
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
              <p className="font-medium mb-1">ⓘ Automation is OFF by default</p>
              <p className="text-xs text-blue-700">
                After import, go to campaign detail to attach rules and enable automation.
                Your campaign will continue running in Meta unchanged until you attach rules.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handleImport}
              disabled={importing || !internalName}
              className="btn-primary flex items-center gap-2"
            >
              {importing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Importing...
                </>
              ) : (
                <>Import & Sync <HelpHint k="im.confirm" /></>
              )}
            </button>
            <button onClick={cancelImport} disabled={importing} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
