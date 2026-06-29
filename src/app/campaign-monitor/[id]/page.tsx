'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import TopUpTab from './TopUpTab'
import { ruleToReadable } from '@/lib/rule-readable'
import { HelpHint } from '@/components/ui/HelpHint'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// ── Types ─────────────────────────────────────────────────────────────────

interface Session {
  id: string; name: string; status: string; phase: string
  automationEnabled: boolean; dailyBudget: string; currency: string; objective: string
  monitorIntervalMinutes: number; insightWindow: string; lastMonitorAt: string | null; nextMonitorAt: string | null
  lastActionAt: string | null; source: string; importStatus: string | null
  minActiveAds: number; topupEnabled: boolean
  product: { id: string; name: string } | null
  metaAdAccount: { id: string; adAccountId: string; accountName: string | null } | null
  metaEntities: MetaEntity[]; latestSnapshot: MetricSnapshot | null
  automationRulesCount: number
  _count?: { automationRules: number }
}

interface MetaEntity { id: string; entityType: string; metaEntityId: string; name: string; effectiveStatus: string | null; configuredStatus: string | null; lastSyncedAt: string; parentMetaEntityId: string | null }

interface MetricSnapshot { spend: number; leads: number; purchases: number; roas: number | null; cpc: number | null; impressions: number; clicks: number; windowEnd: string }

interface AutomationAction { id: string; source: string; actionType: string; status: string; requestedAt: string; executedAt: string | null; targetMetaEntityId: string | null; payloadJson: string; errorMessage: string | null }

interface AutomationRule { id: string; name: string; description: string | null; status: string; ruleCategory: string; scope: string; conditionTreeJson: string; actionSpecJson: string; sourceTemplateId: string | null; lastFiredAt: string | null; fireCount: number; cooldownMinutes?: number }

interface TopupLog { id: string; triggeredAt: string; activeAdsBefore: number; minActiveAds: number; status: string; poolCreativeId: string | null; note: string | null; automationActionId: string | null }

// ── Helpers ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string,string> = { RUNNING:'bg-green-100 text-green-800', PAUSED:'bg-yellow-100 text-yellow-800', KILLED:'bg-red-100 text-red-800', COMPLETED:'bg-stone-100 text-stone-600', ERROR:'bg-red-100 text-red-800', DRAFT:'bg-stone-100 text-stone-600', QUEUED:'bg-blue-100 text-blue-800', CREATING:'bg-violet-100 text-violet-800', APPROVAL_REQUIRED:'bg-yellow-100 text-yellow-800' }
const PHASE_COLORS: Record<string,string> = { TESTING:'bg-blue-100 text-blue-800', SCALING:'bg-violet-100 text-violet-800', MAINTENANCE:'bg-stone-100 text-stone-600', EXITED:'bg-red-100 text-red-800' }
const ACTION_STATUS_COLORS: Record<string,string> = { PENDING:'bg-yellow-100 text-yellow-800', SUCCEEDED:'bg-green-100 text-green-800', FAILED:'bg-red-100 text-red-800', UNCERTAIN:'bg-orange-100 text-orange-800', CANCELLED:'bg-stone-100 text-stone-600' }
const SOURCE_BADGES: Record<string,{label:string;cls:string}> = { launch:{label:'🚀 Launch',cls:'bg-violet-100 text-violet-800'}, imported:{label:'🔵 Imported',cls:'bg-blue-100 text-blue-800'} }
const ENTITY_TYPE_COLORS: Record<string,string> = { CAMPAIGN:'bg-violet-100 text-violet-800', ADSET:'bg-blue-100 text-blue-800', AD:'bg-green-100 text-green-800', CREATIVE:'bg-orange-100 text-orange-800' }

function StatusBadge({status}:{status:string}) { return <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[status]??'bg-stone-100 text-stone-600'}`}>{status}</span> }
function PhaseBadge({phase}:{phase:string}) { return <span className={`text-xs px-2 py-1 rounded-full font-medium ${PHASE_COLORS[phase]??'bg-stone-100 text-stone-600'}`}>{phase}</span> }
function SourceBadge({source}:{source:string}) { const d=SOURCE_BADGES[source]??{label:source,cls:'bg-stone-100 text-stone-600'}; return <span className={`text-xs px-2 py-1 rounded-full font-medium ${d.cls}`}>{d.label}</span> }
function fmtCurrency(n:number|null|undefined,currency='IDR') { return n==null?'—':`${currency} ${Number(n).toLocaleString('id-ID',{maximumFractionDigits:0})}` }
function fmtDate(d:string|null) { if(!d)return'—';return new Date(d).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) }
function fmtDateOrNever(d:string|null) { return d?fmtDate(d):'Never' }

type Tab = 'overview' | 'automation' | 'activity'

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [actions, setActions] = useState<AutomationAction[]>([])
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [topupLogs, setTopupLogs] = useState<TopupLog[]>([])
  const [togglingAuto, setTogglingAuto] = useState(false)
  const [savingInterval, setSavingInterval] = useState(false)
  const [intervalVal, setIntervalVal] = useState(15)
  const [insightWindowVal, setInsightWindowVal] = useState('maximum')
  const [logs, setLogs] = useState<TopupLog[]>([])
  const [detachRuleId, setDetachRuleId] = useState<string | null>(null)

  // ── Fetch session ──
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/campaign-sessions/${id}`, { credentials:'include' })
      if(!res.ok) throw new Error()
      const data = await res.json()
      const loaded = data.session as Session
      setSession(loaded)
      setIntervalVal(loaded.monitorIntervalMinutes)
      setInsightWindowVal(loaded.insightWindow ?? 'maximum')
      if(!loaded.latestSnapshot) {
        try {
          const mRes = await fetch(`/api/admin/campaign-sessions/${id}/metrics`, { credentials:'include' })
          if(mRes.ok) { const mData=await mRes.json(); const m=mData.metrics as MetricSnapshot[]|undefined; if(m&&m.length>0) setSession(p=>p?{...p,latestSnapshot:m[0]}:p) }
        } catch{}
      }
    } catch{} finally { setLoading(false) }
  },[id])

  // ── Fetch actions + rules + topup logs ──
  const fetchAllData = useCallback(async () => {
    const [actRes, ruleRes, logRes] = await Promise.all([
      fetch(`/api/admin/campaign-sessions/${id}/actions`, { credentials:'include' }),
      fetch(`/api/admin/campaign-sessions/${id}/rules`, { credentials:'include' }),
      fetch(`/api/admin/campaign-sessions/${id}/topup-log`, { credentials:'include' }),
    ])
    if(actRes.ok) { const d=await actRes.json(); setActions(d.actions??[]) }
    if(ruleRes.ok) { const d=await ruleRes.json(); setRules(d.rules??[]) }
    if(logRes.ok) { const d=await logRes.json(); setLogs(d.logs??[]) }
  },[id])

  useEffect(()=>{fetchSession()},[fetchSession])
  useEffect(()=>{if(activeTab==='activity'||activeTab==='automation')fetchAllData()},[activeTab,fetchAllData])

  // ── Auto toggle ──
  const handleAutoToggle = async () => {
    if(!session) return; setTogglingAuto(true)
    try {
      const res = await fetch(`/api/admin/campaign-sessions/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify({automationEnabled:!session.automationEnabled}) })
      if(res.ok) setSession({...session,automationEnabled:!session.automationEnabled})
      else { const d=await res.json().catch(()=>({})); alert(d.error??'Gagal toggle automation') }
    } finally { setTogglingAuto(false) }
  }

  // ── Interval save ──
  const handleIntervalChange = async (val:number) => {
    setIntervalVal(val); setSavingInterval(true)
    try {
      await fetch(`/api/admin/campaign-sessions/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify({monitorIntervalMinutes:val}) })
    } finally { setSavingInterval(false) }
  }

  // ── Insight window change ──
  const handleInsightWindowChange = async (val:string) => {
    setInsightWindowVal(val)
    try {
      await fetch(`/api/admin/campaign-sessions/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify({insightWindow:val}) })
    } catch{}
  }

  // ── Rule toggle ──
  const handleRuleToggle = async (ruleId:string, currentStatus:string) => {
    const ns = currentStatus==='ACTIVE'?'PAUSED':'ACTIVE'
    try {
      const res = await fetch(`/api/admin/automation-rules/${ruleId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify({status:ns}) })
      if(res.ok) setRules(p=>p.map(r=>r.id===ruleId?{...r,status:ns}:r))
    } catch{}
  }

  const handleDetachRule = (ruleId:string) => {
    setDetachRuleId(ruleId)
  }

  const handleDetachRuleConfirm = async () => {
    if (!detachRuleId) return
    const ruleId = detachRuleId
    setDetachRuleId(null)
    try {
      const res = await fetch(`/api/admin/campaign-sessions/${id}/rules?ruleId=${ruleId}`, { method:'DELETE', credentials:'include' })
      if(res.ok) setRules(p=>p.filter(r=>r.id!==ruleId))
    } catch{}
  }

  // ── Render ──

  if(loading) return <div className="flex items-center justify-center h-64 text-stone-400 text-sm">Loading...</div>
  if(!session) return <div className="flex flex-col items-center justify-center h-64 text-stone-400 text-sm gap-2"><p>Campaign not found.</p><Link href="/ads?tab=monitor" className="btn-ghost btn-sm">← Back</Link></div>

  const snap = session.latestSnapshot
  const hasRules = rules.length > 0 || session.automationRulesCount > 0
  const setupDone = hasRules && session.automationEnabled
  const sourceBadge = SOURCE_BADGES[session.source]
  const INTERVAL_OPTIONS = [1,2,3,5,10,15,30,60]

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Link href="/ads?tab=monitor" className="text-stone-400 hover:text-stone-600 text-sm">← Campaign Monitor</Link>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">{session.name}</h1>
            <p className="text-sm text-stone-500 mt-0.5">
              {session.product?.name??'No product'} &bull; {session.metaAdAccount?.accountName??session.metaAdAccount?.adAccountId??'No ad account'}
              {sourceBadge && <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${sourceBadge.cls}`}>{sourceBadge.label}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={session.status} />
          <PhaseBadge phase={session.phase} />
        </div>
      </div>

      {/* ── Checklist Banner ── */}
      {!setupDone && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6">
          <p className="text-sm font-semibold text-amber-800 mb-2">Setup Campaign Ini</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-600 font-bold">✅</span>
              <span className="text-stone-700">1. Campaign ke-sync dari Meta</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-600 font-bold">✅</span>
              <span className="text-stone-700">2. Budget &amp; struktur kebaca</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {hasRules ? <span className="text-green-600 font-bold">✅</span> : <span className="text-stone-400 font-bold">⬜</span>}
              <span className="text-stone-700">3. Pasang minimal 1 aturan {!hasRules && <Link href={`/campaign-monitor/${id}/rules/new`} className="text-violet-600 hover:text-violet-800 underline ml-2">→ Pilih template</Link>}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {session.automationEnabled ? <span className="text-green-600 font-bold">✅</span> : <span className="text-stone-400 font-bold">⬜</span>}
              <span className={`text-stone-700 ${!hasRules ? 'text-stone-400' : ''}`}>
                4. Nyalain automation
                {!hasRules && <span className="text-stone-400 ml-1">(pasang aturan dulu)</span>}
              </span>
            </div>
            {session.minActiveAds > 0 && (
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <span className="text-violet-500">🔄</span>
                <span>Floor auto top-up: {session.minActiveAds} ads · {session.topupEnabled ? 'ON' : 'OFF'}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b border-stone-300 mb-6">
        {(['overview', 'automation', 'activity'] as Tab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${activeTab===tab ? 'text-violet-700 border-violet-700' : 'text-stone-500 border-transparent hover:text-stone-700'}`}>
            {tab === 'overview' ? '📊 Overview' : tab === 'automation' ? '⚙️ Automation' : '📋 Activity'}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
         ── TAB: OVERVIEW ──
         ═══════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-white rounded border border-stone-300 px-4 py-3">
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Daily Budget</p>
              <p className="text-xl font-bold text-stone-900 mt-1">{fmtCurrency(Number(session.dailyBudget), session.currency)}</p>
            </div>
            <div className="bg-white rounded border border-stone-300 px-4 py-3">
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Spend</p>
              <p className="text-xl font-bold text-stone-900 mt-1">{fmtCurrency(snap?.spend??0, session.currency)}</p>
            </div>
            <div className="bg-white rounded border border-stone-300 px-4 py-3">
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Purchases</p>
              <p className="text-xl font-bold text-stone-900 mt-1">{snap?.purchases?.toString()??'—'}</p>
            </div>
            <div className="bg-white rounded border border-stone-300 px-4 py-3">
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">ROAS</p>
              <p className="text-xl font-bold text-stone-900 mt-1">{snap?.roas!=null?`${Number(snap.roas).toFixed(2)}x`: '—'}</p>
            </div>
            <div className="bg-white rounded border border-stone-300 px-4 py-3">
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">CPC</p>
              <p className="text-xl font-bold text-stone-900 mt-1">{snap?.cpc!=null?fmtCurrency(snap.cpc,session.currency):'—'}</p>
            </div>
          </div>

          {/* Automation Summary Card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-stone-900">⚙️ Automation</h2>
              <Link href={`/campaign-monitor/${id}?tab=automation`} className="text-xs text-violet-600 hover:text-violet-800 font-medium"
                onClick={(e)=>{e.preventDefault();setActiveTab('automation')}}>Atur →</Link>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-600 font-medium">Auto: <HelpHint k="cd.autoToggle" /></span>
                <button onClick={handleAutoToggle} disabled={togglingAuto}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 ${session.automationEnabled?'bg-violet-600':'bg-stone-300'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${session.automationEnabled?'translate-x-4':'translate-x-1'}`} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-600 font-medium">Scan: <HelpHint k="cd.scanInterval" /></span>
                <select value={intervalVal} onChange={(e)=>handleIntervalChange(Number(e.target.value))} disabled={savingInterval} data-tour="cd-scan-interval"
                  className="border border-stone-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {INTERVAL_OPTIONS.map(v => <option key={v} value={v}>tiap {v}m</option>)}
                </select>
                {savingInterval && <span className="text-[10px] text-stone-400">...</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-600 font-medium">Periode:</span>
                <select value={insightWindowVal} onChange={(e)=>handleInsightWindowChange(e.target.value)}
                  className="border border-stone-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="maximum">Lifetime</option>
                  <option value="last_7d">7 hari terakhir</option>
                  <option value="last_14d">14 hari terakhir</option>
                  <option value="last_3d">3 hari terakhir</option>
                  <option value="today">Hari ini</option>
                </select>
              </div>
              <div className="text-xs text-stone-500">
                {rules.length} rules aktif · floor {session.minActiveAds} ads · pool {session.topupEnabled?'ON':'OFF'}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-4 text-xs text-stone-500">
              <span>Terakhir scan: {fmtDateOrNever(session.lastMonitorAt)}</span>
              <span>Next: {fmtDateOrNever(session.nextMonitorAt)}</span>
              {session.lastActionAt && <span>Aksi terakhir: {fmtDate(session.lastActionAt)}</span>}
            </div>
          </div>

          {/* Raw Meta State (accordion) */}
          <details className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <summary className="px-5 py-3 text-sm font-medium text-stone-700 cursor-pointer hover:bg-stone-50 transition-colors">
              📦 Meta Campaign Structure <HelpHint k="cd.structure" /> ({session.metaEntities.length} entities)
            </summary>
            <div className="px-5 pb-4 pt-2 space-y-4">
              {session.metaEntities.length===0 ? (
                <p className="text-xs text-stone-400 py-4 text-center">No Meta entities synced yet.</p>
              ) : (
                ['CAMPAIGN','ADSET','AD'].map(et => {
                  const ents = session.metaEntities.filter(e=>e.entityType===et)
                  if(!ents.length) return null
                  return <div key={et}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${ENTITY_TYPE_COLORS[et]??'bg-stone-100'}`}>{et}</span>
                      <span className="text-xs text-stone-500">{ents.length}</span>
                    </div>
                    <div className="space-y-1">
                      {ents.map(ent => (
                        <div key={ent.id} className="flex items-center gap-3 bg-stone-50 rounded border border-stone-200 px-4 py-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-stone-800 truncate">{ent.name}</p>
                              {ent.effectiveStatus && <span className={`text-xs px-1.5 py-0.5 rounded ${['ACTIVE','RUNNING','PAUSED'].includes(ent.effectiveStatus)?'bg-green-100 text-green-700':ent.effectiveStatus==='DISABLED'?'bg-red-100 text-red-700':'bg-stone-100 text-stone-600'}`}>{ent.effectiveStatus}</span>}
                            </div>
                            <p className="text-xs text-stone-400 mt-0.5">ID: {ent.metaEntityId}{ent.configuredStatus&&ent.configuredStatus!==ent.effectiveStatus?` | Configured: ${ent.configuredStatus}`:''}</p>
                          </div>
                          <p className="text-xs text-stone-400 whitespace-nowrap">Synced {fmtDate(ent.lastSyncedAt)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                })
              )}
            </div>
          </details>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
         ── TAB: AUTOMATION ──
         ═══════════════════════════════════════════════════════ */}
      {activeTab === 'automation' && (
        <div className="space-y-8">
          {/* Section: Rules */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-stone-900">📋 Aturan ({rules.length})</h2>
              <Link href={`/campaign-monitor/${id}/rules/new`} data-tour="cd-attach-rule" className="btn-primary btn-sm">+ Pasang Template <HelpHint k="cd.attachRule" /></Link>
            </div>
            {rules.length===0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-stone-400 text-sm gap-2 bg-white rounded-xl border border-stone-200">
                <p>Belum ada aturan otomatis.</p>
                <Link href={`/campaign-monitor/${id}/rules/new`} className="btn-ghost btn-sm">+ Pasang template aturan</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map(rule => (
                  <div key={rule.id} className="bg-white rounded-xl border border-stone-200 p-4 hover:border-violet-300 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-stone-900">{rule.name}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${rule.status==='ACTIVE'?'bg-green-100 text-green-700':rule.status==='PAUSED'?'bg-yellow-100 text-yellow-700':'bg-stone-100 text-stone-600'}`}>{rule.status}</span>
                        </div>
                        <p className="text-xs font-mono text-stone-600 bg-stone-50 rounded px-2 py-1 mt-1">
                          {ruleToReadable(rule.conditionTreeJson, rule.actionSpecJson)}
                        </p>
                        <p className="text-xs text-stone-400 mt-1">
                          Fired {rule.fireCount}x{rule.lastFiredAt&&` · Last ${fmtDate(rule.lastFiredAt)}`} · cooldown {rule.cooldownMinutes??60}m
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span><HelpHint k="cd.ruleToggle" /></span>
                        <button onClick={()=>handleRuleToggle(rule.id,rule.status)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.status==='ACTIVE'?'bg-violet-600':'bg-stone-300'}`} title={rule.status==='ACTIVE'?'Pause':'Activate'}>
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${rule.status==='ACTIVE'?'translate-x-4':'translate-x-1'}`} />
                        </button>
                        <button onClick={()=>handleDetachRule(rule.id)} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50">Lepas <HelpHint k="cd.ruleDetach" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section: Top-Up */}
          <section>
            <h2 className="text-sm font-bold text-stone-900 mb-3">🔼 Auto Top-Up</h2>
            <TopUpTab sessionId={id} compact />
          </section>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
         ── TAB: ACTIVITY ──
         ═══════════════════════════════════════════════════════ */}
      {activeTab === 'activity' && (
        <ActivityFeed sessionId={id} actions={actions} rules={rules} topupLogs={topupLogs} onRefresh={fetchAllData} />
      )}

      <ConfirmDialog
        open={detachRuleId !== null}
        title="Lepas Aturan"
        body={<p>Lepas aturan ini? Riwayat tetap tersimpan.</p>}
        confirmLabel="Lepas"
        danger
        onConfirm={handleDetachRuleConfirm}
        onCancel={() => setDetachRuleId(null)}
      />
    </div>
  )
}

// ── Activity Feed Component ───────────────────────────────────────────

type ActivityFilter = 'all' | 'scan' | 'action' | 'topup'

function ActivityFeed({
  sessionId, actions, rules, topupLogs, onRefresh,
}: {
  sessionId: string; actions: AutomationAction[]; rules: AutomationRule[]
  topupLogs: TopupLog[]; onRefresh: () => void
}) {
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [ruleExecs, setRuleExecs] = useState<Array<{id:string;evaluatedAt:string;matched:boolean;reasonText:string|null;ruleName:string;actionCreatedId:string|null}>>([])

  // Fetch rule executions
  useEffect(() => {
    const fetchExecs = async () => {
      try {
        const res = await fetch(`/api/admin/campaign-sessions/${sessionId}/rule-executions?limit=50`, { credentials:'include' })
        if(res.ok) { const d=await res.json(); setRuleExecs(d.executions??[]) }
      } catch{}
    }
    fetchExecs()
  }, [sessionId, onRefresh])

  // Build combined timeline
  const timeline: Array<{
    id: string; occurredAt: string; type: 'scan' | 'action' | 'topup'
    title: string; detail: string; status?: string; dedupKey: string
  }> = []

  // Rule executions → scan events
  for (const exec of ruleExecs) {
    const rule = rules.find(r => r.name === exec.ruleName)
    timeline.push({
      id: exec.id, occurredAt: exec.evaluatedAt, type: 'scan',
      title: exec.matched ? `✅ Rule "${exec.ruleName}" match` : `🔄 Scan — "${exec.ruleName}" ${exec.matched ? 'match' : 'no match'}`,
      detail: exec.reasonText ?? '',
      dedupKey: `scan-${exec.id}`,
    })
  }

  // Actions
  for (const a of actions) {
    let title = ''
    try { const p=JSON.parse(a.payloadJson??'{}'); if(a.actionType==='UPDATE_BUDGET'&&p.dailyBudget) title=`💰 Budget → Rp ${Number(p.dailyBudget).toLocaleString('id-ID')}` } catch{}
    timeline.push({
      id: a.id, occurredAt: a.requestedAt, type: 'action',
      title: title || `${ACTION_TYPES[a.actionType]??a.actionType} ${a.targetMetaEntityId??''}`,
      detail: `Source: ${a.source} · ${a.status}${a.errorMessage?` · ${a.errorMessage}`:''}`,
      status: a.status, dedupKey: `action-${a.id}`,
    })
  }

  // Top-up logs
  for (const l of topupLogs) {
    timeline.push({
      id: l.id, occurredAt: l.triggeredAt, type: 'topup',
      title: `🔼 Top-up — ${l.activeAdsBefore}→? ads, floor ${l.minActiveAds}`,
      detail: `${l.status}${l.note?` · ${l.note}`:''}`,
      status: l.status, dedupKey: `topup-${l.id}`,
    })
  }

  // Sort by time desc
  timeline.sort((a,b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())

  const filtered = filter==='all' ? timeline : timeline.filter(t => t.type===filter)
  const STATUS_CLS: Record<string,string> = { SUCCEEDED:'text-green-600', FAILED:'text-red-600', PENDING:'text-yellow-600', succeeded:'text-green-600', failed:'text-red-600', pending:'text-yellow-600', skipped_empty_pool:'text-orange-600' }

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex items-center gap-2">
        {(['all','scan','action','topup'] as ActivityFilter[]).map(f => (
          <button key={f} onClick={()=>setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filter===f?'bg-violet-100 text-violet-800':'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
            {f==='all'?'Semua':f==='scan'?'🔄 Scan':f==='action'?'⚙️ Aksi':'🔼 Top-up'}
          </button>
        ))}
        <button onClick={onRefresh} className="text-xs text-stone-400 hover:text-stone-600 ml-auto">↻ Refresh</button>
      </div>

      {/* Timeline */}
      {filtered.length===0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-stone-400 text-sm">Belum ada aktivitas.</div>
      ) : (
        <div className="space-y-1">
          {filtered.map(item => (
            <div key={item.dedupKey} className="flex items-start gap-3 px-4 py-2.5 bg-white rounded-lg border border-stone-200 hover:border-stone-300 transition-colors">
              <span className="text-[10px] text-stone-400 w-16 shrink-0 pt-0.5">{fmtDate(item.occurredAt)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-stone-800">{item.title}</p>
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <span>{item.detail}</span>
                  {item.status && <span className={`font-medium ${STATUS_CLS[item.status]??'text-stone-500'}`}>{item.status}</span>}
                  <span className={`text-[10px] px-1 py-0.5 rounded ${item.type==='scan'?'bg-blue-50 text-blue-600':item.type==='action'?'bg-violet-50 text-violet-600':'bg-orange-50 text-orange-600'}`}>{item.type}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const ACTION_TYPES: Record<string,string> = {
  PAUSE_CAMPAIGN:'⏸ Pause Campaign', PAUSE_ADSET:'⏸ Pause AdSet', PAUSE:'⏸ Pause',
  RESUME_CAMPAIGN:'▶️ Resume Campaign', RESUME_ADSET:'▶️ Resume AdSet',
  UPDATE_BUDGET:'💰 Update Budget', CREATE_AD:'➕ Create Ad', REPLACE_AD:'🔄 Replace Ad',
  NOTIFY:'🔔 Notify', CREATE_CAMPAIGN:'🚀 Create Campaign',
}
