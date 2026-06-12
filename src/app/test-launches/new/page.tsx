'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PageInfo from '@/components/ui/PageInfo'
import StepZeroOverlay from '@/components/StepZeroOverlay'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MetaConnection {
  id: string
  name: string | null
  appId: string | null
  status: string
  accountName: string | null
  adAccounts: Array<{
    id: string
    adAccountId: string
    adAccountName: string | null
  }>
  pages: Array<{
    id: string
    pageId: string
    pageName: string | null
    igBusinessAccountId: string | null
    igUsername: string | null
    igName: string | null
  }>
}

interface AdAccount {
  id: string
  adAccountId: string
  adAccountName: string | null
  currency: string | null
}

interface Page {
  id: string
  pageId: string
  pageName: string | null
  igBusinessAccountId: string | null
  igUsername: string | null
  igName: string | null
}

interface Pixel {
  id: string
  name: string
}

interface CustomAudienceOption {
  id: string
  name: string
  approximateCount: number | null
  deliveryStatus: unknown
}

interface CreativeDraft {
  id: string
  format: 'single' | 'carousel'
  imageUrl: string
  linkUrl: string
  primaryText: string
  headline: string
  description: string
  callToAction: string
  urlTags: string
  childAttachmentsJson: string // JSON stringified carousel cards
}

interface AdsetDraft {
  id: string
  name: string
  dailyBudget: string          // ABO only
  bidStrategy: string           // JSON, ABO only, null = inherit
  bidAmount: string
  roasAverageFloor: string
  pixelId: string
  customEventType: string
  // Audience
  ageMin: number
  ageMax: number
  gender: 'all' | 'male' | 'female'
  // Schedule
  scheduleMode: 'now' | 'scheduled'
  startTime: string
  endTime: string
  // Placement
  placementMode: 'automatic' | 'manual'
  placements: string[]
  // Targeting extras
  includedCustomAudienceIds: string
  excludedCustomAudienceIds: string
  interests: Array<{id: string; name: string; audienceSizeLowerBound?: number}>
  devicePlatform: 'all' | 'mobile' | 'desktop'
  // Identity
  identityPageId: string
  identityIgUserId: string
  // Creatives per adset
  creatives: CreativeDraft[]
}

interface FormData {
  // Step 1: Campaign
  name: string
  metaConnectionId: string
  metaAdAccountId: string
  objective: string
  dailyBudget: string
  currency: string
  budgetMode: 'CBO' | 'ABO'
  bidStrategy: string          // JSON for CBO campaign-level
  bidAmount: string            // CBO: COST_CAP / BID_CAP
  roasAverageFloor: string     // CBO: MIN_ROAS

  // Step 2 & 3: Ad Sets & Ads
  adsets: AdsetDraft[]
  
  // Derived
  notes: string
}

interface LaunchPrefillResponse {
  prefill: {
    campaignName: string
    objective: string
    metaAccountId: string | null
    metaAdAccountId: string | null
    pageId: string | null
    igAccountId: string | null
    pixelId: string | null
    landingPageUrl: string | null
    audience: { ageMin: number; ageMax: number; gender: 'all' | 'male' | 'female' }
    media: Array<{ url: string; type: string; source: string }>
  }
  product: { id: string; name: string }
  sources: Record<string, string>
}

interface CopyVariant {
  primaryText: string
  headline: string
  description: string
  truncated?: boolean
}

interface BidStrategyOption {
  value: string
  label: string
  description: string
  requiresAmount: boolean
  amountLabel?: string
  available: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

const OBJECTIVE_OPTIONS = [
  { value: 'OUTCOME_LEADS', label: 'Leads' },
  { value: 'OUTCOME_SALES', label: 'Sales' },
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic' },
]

const BUDGET_MODE_OPTIONS = [
  { value: 'CBO', label: 'CBO — Budget Campaign' },
  { value: 'ABO', label: 'ABO — Budget per Ad Set' },
]

const CTA_OPTIONS = [
  { value: 'LEARN_MORE', label: 'Learn More' },
  { value: 'SHOP_NOW', label: 'Shop Now' },
  { value: 'SIGN_UP', label: 'Sign Up' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'BOOK_NOW', label: 'Book Now' },
]

const GENDER_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'male', label: 'Laki-laki' },
  { value: 'female', label: 'Perempuan' },
]

const PLACEMENT_OPTIONS = [
  { value: 'facebook_feed', label: 'Facebook Feed' },
  { value: 'facebook_stories', label: 'Facebook Stories' },
  { value: 'facebook_reels', label: 'Facebook Reels' },
  { value: 'facebook_video_feeds', label: 'Facebook Video Feeds' },
  { value: 'facebook_marketplace', label: 'Facebook Marketplace' },
  { value: 'facebook_search', label: 'Facebook Search' },
  { value: 'instagram_feed', label: 'Instagram Feed' },
  { value: 'instagram_stories', label: 'Instagram Stories' },
  { value: 'instagram_reels', label: 'Instagram Reels' },
  { value: 'instagram_explore', label: 'Instagram Explore' },
  { value: 'instagram_profile_feed', label: 'Instagram Profile Feed' },
  { value: 'messenger_inbox', label: 'Messenger Inbox' },
  { value: 'messenger_stories', label: 'Messenger Stories' },
  { value: 'audience_network_native', label: 'Audience Network Native' },
  { value: 'audience_network_rewarded', label: 'Audience Network Rewarded' },
]

const EVENT_OPTIONS = [
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'LEAD', label: 'Lead' },
  { value: 'ADD_TO_CART', label: 'Add to Cart' },
  { value: 'COMPLETE_REGISTRATION', label: 'Complete Registration' },
  { value: 'INITIATED_CHECKOUT', label: 'Initiated Checkout' },
  { value: 'CONTACT', label: 'Contact' },
]

const DEVICE_OPTIONS = [
  { value: 'all', label: 'Semua Device' },
  { value: 'mobile', label: 'Mobile Saja' },
  { value: 'desktop', label: 'Desktop Saja' },
]

const STEPS = ['Campaign', 'Ad Sets', 'Ads', 'Review'] as const
type Step = typeof STEPS[number]

const inputCls = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'
const labelCls = 'block text-sm font-medium text-stone-700 mb-1'
const sectionCls = 'bg-white rounded-xl border border-stone-200 p-5 space-y-4'
const cardCls = 'border border-stone-200 rounded-xl p-5 space-y-4 bg-white'

function parseCommaIds(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

function formatAudienceSize(value?: number | null): string {
  if (!value || value <= 0) return '—'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace('.', ',')} m`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')} jt`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.', ',')} rb`
  return value.toLocaleString('id-ID')
}

function emptyCreative(): CreativeDraft {
  return {
    id: crypto.randomUUID(),
    format: 'single',
    imageUrl: '',
    linkUrl: '',
    primaryText: '',
    headline: '',
    description: '',
    callToAction: 'LEARN_MORE',
    urlTags: '',
    childAttachmentsJson: '[]',
  }
}

function emptyAdset(name: string, idx: number): AdsetDraft {
  return {
    id: crypto.randomUUID(),
    name: name || `Adset ${idx + 1}`,
    dailyBudget: '',
    bidStrategy: '',
    bidAmount: '',
    roasAverageFloor: '',
    pixelId: '',
    customEventType: 'PURCHASE',
    ageMin: 25,
    ageMax: 45,
    gender: 'all',
    scheduleMode: 'now',
    startTime: '',
    endTime: '',
    placementMode: 'automatic',
    placements: [],
    includedCustomAudienceIds: '',
    excludedCustomAudienceIds: '',
    interests: [],
    devicePlatform: 'all',
    identityPageId: '',
    identityIgUserId: '',
    creatives: [emptyCreative()],
  }
}

function day(d: string) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewTestLaunchPage() {
  const router = useRouter()

  // Deps
  const [metaConnections, setMetaConnections] = useState<MetaConnection[]>([])
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [pixels, setPixels] = useState<Pixel[]>([])
  const [customAudiences, setCustomAudiences] = useState<CustomAudienceOption[]>([])
  const [customAudienceError, setCustomAudienceError] = useState<string | null>(null)
  const [bidStrategies, setBidStrategies] = useState<BidStrategyOption[]>([])
  const [loadingDeps, setLoadingDeps] = useState(true)

  // Form
  const [currentStep, setCurrentStep] = useState<Step>('Campaign')
  const [form, setForm] = useState<FormData>({
    name: '',
    metaConnectionId: '',
    metaAdAccountId: '',
    objective: 'OUTCOME_LEADS',
    dailyBudget: '',
    currency: 'IDR',
    budgetMode: 'CBO',
    bidStrategy: '',
    bidAmount: '',
    roasAverageFloor: '',
    adsets: [emptyAdset('', 0)],
    notes: '',
  })

  // UI state
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedPage, setSelectedPage] = useState<Page | null>(null)
  const [availablePages, setAvailablePages] = useState<Page[]>([])
  const [mediaAssets, setMediaAssets] = useState<Array<{id: string; publicUrl: string | null; fileUrl: string | null; thumbnailUrl: string | null; type: string; label: string | null}>>([])
  const [showPicker, setShowPicker] = useState<Map<string,boolean>>(new Map())
  const [showStepZero, setShowStepZero] = useState(true)
  const [autoSources, setAutoSources] = useState<Record<string, string>>({})
  const clearAutoSource = (key: string) =>
    setAutoSources(prev => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  const [prefillProductId, setPrefillProductId] = useState<string | null>(null)
  const [prefillLoading, setPrefillLoading] = useState(false)
  const [copyVariants, setCopyVariants] = useState<Record<string, CopyVariant[]>>({})
  const [copyLoadingKey, setCopyLoadingKey] = useState<string | null>(null)

  const stepIndex = (STEPS as readonly string[]).indexOf(currentStep)

  // ── Fetch logic ──────────────────────────────────────────────────────────

  const fetchMetaConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/meta-connections', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setMetaConnections(data.metaAccounts ?? [])
      }
    } catch { /* silent */ }
    finally { setLoadingDeps(false) }
  }, [])

  useEffect(() => { fetchMetaConnections() }, [fetchMetaConnections])

  const fetchAdAccounts = useCallback(async (metaConnectionId: string) => {
    if (!metaConnectionId) { setAdAccounts([]); return }
    try {
      const res = await fetch(`/api/admin/assets/ad-accounts?metaAccountId=${metaConnectionId}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setAdAccounts(data.adAccounts ?? [])
      }
    } catch { /* silent */ }
  }, [])

  const fetchPages = useCallback(async (metaConnectionId: string) => {
    if (!metaConnectionId) { setPages([]); return }
    try {
      const res = await fetch(`/api/admin/assets/pages?metaAccountId=${metaConnectionId}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const plist = data.pages ?? []
        setPages(plist)
        setAvailablePages(plist)
      }
    } catch { /* silent */ }
  }, [])

  const fetchPixels = useCallback(async (adAccountId: string) => {
    if (!adAccountId) { setPixels([]); return }
    try {
      const res = await fetch(`/api/admin/meta-tools/adspixels?adAccountId=${adAccountId}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPixels(data.pixels ?? [])
      }
    } catch { setPixels([]) }
  }, [])

  const fetchCustomAudiences = useCallback(async (adAccountId: string) => {
    if (!adAccountId) { setCustomAudiences([]); return }
    setCustomAudienceError(null)
    try {
      const res = await fetch(`/api/admin/meta-tools/customaudiences?adAccountId=${adAccountId}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setCustomAudiences(data.audiences ?? [])
      } else {
        const body = await res.json().catch(()=>({}))
        setCustomAudiences([])
        setCustomAudienceError(body.error || 'Gagal memuat custom audience')
      }
    } catch {
      setCustomAudiences([])
      setCustomAudienceError('Custom audience tidak bisa dimuat')
    }
  }, [])

  const fetchBidStrategies = useCallback(async (adAccountId: string) => {
    if (!adAccountId) { setBidStrategies([]); return }
    try {
      const res = await fetch(`/api/admin/meta-tools/adaccount-capabilities?adAccountId=${adAccountId}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setBidStrategies(data.bidStrategies ?? [])
      }
    } catch { setBidStrategies([]) }
  }, [])

  const fetchMediaAssets = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/media-assets?status=READY', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setMediaAssets(data.assets ?? [])
      }
    } catch {
      setMediaAssets([])
    }
  }, [])

  useEffect(() => { fetchMediaAssets() }, [fetchMediaAssets])

  // Handlers
  const handleMetaConnectionChange = (id: string) => {
    clearAutoSource('metaAccountId')
    setForm((f) => ({ ...f, metaConnectionId: id, metaAdAccountId: '', pageId: '' }))
    setSelectedPage(null)
    setAdAccounts([])
    setPages([])
    setPixels([])
    setBidStrategies([])
    if (id) {
      fetchAdAccounts(id)
      fetchPages(id)
    }
  }

  const handleAdAccountChange = (id: string) => {
    clearAutoSource('metaAdAccountId')
    clearAutoSource('pixelId')
    setAutoSources((s) => ({ ...s, metaAdAccountId: '', pixelId: '' })); setForm((f) => ({ ...f, metaAdAccountId: id, pixelId: '' }))
    setPixels([])
    setCustomAudiences([])
    setCustomAudienceError(null)
    if (id) {
      fetchPixels(id)
      fetchBidStrategies(id)
      fetchCustomAudiences(id)
    }
  }

  const handleSelectPage = (page: Page) => {
    setSelectedPage(page)
    // Update identity on all adsets
    setForm((f) => ({
      ...f,
      adsets: f.adsets.map((a) => ({
        ...a,
        identityPageId: page.pageId,
        identityIgUserId: page.igBusinessAccountId || '',
      })),
    }))
  }

  const updateAdsetField = (id: string, field: string, value: unknown) => {
    setForm((f) => ({
      ...f,
      adsets: f.adsets.map((a) => (a.id === id ? { ...a, [field]: value } : a)),
    }))
  }

  const addAdset = () => {
    setForm((f) => ({
      ...f,
      adsets: [...f.adsets, emptyAdset(f.name, f.adsets.length)],
    }))
  }

  const removeAdset = (id: string) => {
    setForm((f) => ({
      ...f,
      adsets: f.adsets.length > 1 ? f.adsets.filter((a) => a.id !== id) : f.adsets,
    }))
  }

  const duplicateAdset = (id: string) => {
    setForm((f) => {
      const src = f.adsets.find((a) => a.id === id)
      if (!src) return f
      const copy: AdsetDraft = {
        ...structuredClone(src),
        id: crypto.randomUUID(),
        name: src.name + ' (copy)',
        creatives: src.creatives.map((c) => ({ ...c, id: crypto.randomUUID() })),
      }
      const idx = f.adsets.findIndex((a) => a.id === id)
      const adsets = [...f.adsets]
      adsets.splice(idx + 1, 0, copy)
      return { ...f, adsets }
    })
  }

  const addCreativeToAdset = (adsetId: string) => {
    setForm((f) => ({
      ...f,
      adsets: f.adsets.map((a) =>
        a.id === adsetId ? { ...a, creatives: [...a.creatives, emptyCreative()] } : a
      ),
    }))
  }

  const removeCreativeFromAdset = (adsetId: string, creativeId: string) => {
    setForm((f) => ({
      ...f,
      adsets: f.adsets.map((a) =>
        a.id === adsetId
          ? { ...a, creatives: a.creatives.length > 1 ? a.creatives.filter((c) => c.id !== creativeId) : a.creatives }
          : a
      ),
    }))
  }

  const updateCreativeField = (adsetId: string, creativeId: string, field: string, value: string) => {
    setForm((f) => ({
      ...f,
      adsets: f.adsets.map((a) =>
        a.id === adsetId
          ? {
              ...a,
              creatives: a.creatives.map((c) => (c.id === creativeId ? { ...c, [field]: value } : c)),
            }
          : a
      ),
    }))
  }

  const addInterest = (adsetId: string, interest: { id: string; name: string }) => {
    setForm((f) => ({
      ...f,
      adsets: f.adsets.map((a) =>
        a.id === adsetId && !a.interests.some((i) => i.id === interest.id)
          ? { ...a, interests: [...a.interests, interest] }
          : a
      ),
    }))
  }

  const removeInterest = (adsetId: string, interestId: string) => {
    setForm((f) => ({
      ...f,
      adsets: f.adsets.map((a) =>
        a.id === adsetId ? { ...a, interests: a.interests.filter((i) => i.id !== interestId) } : a
      ),
    }))
  }

  const handleBudgetModeChange = (mode: 'CBO' | 'ABO') => {
    setForm((f) => ({
      ...f,
      budgetMode: mode,
      dailyBudget: mode === 'CBO' ? f.dailyBudget : '',
    }))
  }

  const applyProductPrefill = async (productId: string) => {
    setPrefillLoading(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/admin/launch-prefill?productId=' + productId, { credentials: 'include' })
      const data = await res.json() as any
      if (!res.ok || !data.prefill) throw new Error(data.error || 'Gagal prefill')
      const p = data.prefill
      setPrefillProductId(productId)
      if (p.sources) setAutoSources(Object.fromEntries(Object.entries(p.sources as Record<string, string>).filter(([, v]) => v !== 'default')))
      setForm((f) => ({
        ...f,
        name: p.campaignName || f.name,
        objective: p.objective || f.objective,
        metaConnectionId: p.metaAccountId || f.metaConnectionId,
        metaAdAccountId: p.metaAdAccountId || f.metaAdAccountId,
        adsets: f.adsets.map((adset, idx) => ({
          ...adset,
          pixelId: p.pixelId || adset.pixelId,
          identityPageId: p.pageId || adset.identityPageId,
          identityIgUserId: p.igAccountId || adset.identityIgUserId,
          ageMin: p.audience?.ageMin || adset.ageMin,
          ageMax: p.audience?.ageMax || adset.ageMax,
          gender: p.audience?.gender || adset.gender,
          creatives: adset.creatives.map((c, ci) => ({
            ...c,
            imageUrl: p.media?.[ci]?.fileUrl || c.imageUrl,
            linkUrl: p.linkUrl || c.linkUrl,
          })),
        })),
      }))
      if (p.metaAccountId) {
        fetchAdAccounts(p.metaAccountId)
        fetchPages(p.metaAccountId)
      }
      if (p.metaAdAccountId) {
        fetchPixels(p.metaAdAccountId)
        fetchBidStrategies(p.metaAdAccountId)
        fetchCustomAudiences(p.metaAdAccountId)
      }
    } catch (err: any) {
      setSaveError(err.message || 'Gagal prefill dari produk')
    } finally {
      setPrefillLoading(false)
    }
  }

  const generateCopyForCreative = async (adsetId: string, creativeId: string) => {
    if (!prefillProductId) return
    const key = adsetId + '__' + creativeId
    setCopyLoadingKey(key)
    try {
      const res = await fetch('/api/admin/meta-tools/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId: prefillProductId, objective: form.objective }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Error ' + res.status)
      setCopyVariants((s) => ({ ...s, [key]: data.variants || [] }))
    } catch (err: any) {
      setSaveError(err.message || 'Gagal generate copy')
    } finally {
      setCopyLoadingKey(null)
    }
  }

  const applyCopyVariant = (adsetId: string, creativeId: string, variant: CopyVariant) => {
    setForm((f) => ({
      ...f,
      adsets: f.adsets.map((a) =>
        a.id === adsetId
          ? {
              ...a,
              creatives: a.creatives.map((c) =>
                c.id === creativeId
                  ? { ...c, primaryText: variant.primaryText || c.primaryText, headline: variant.headline || c.headline, description: variant.description || c.description }
                  : c
              ),
            }
          : a
      ),
    }))
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    setSaveError(null)

    const audienceJson = JSON.stringify({ ageMin: 25, ageMax: 45, gender: 'all', locations: [{ type: 'country', key: 'ID' }] })

    try {
      const body: Record<string, unknown> = {
        budgetMode: form.budgetMode,
        metaAccountId: form.metaConnectionId,
        metaAdAccountId: form.metaAdAccountId,
        name: form.name.trim(),
        objective: form.objective,
        currency: form.currency,
        launchMode: 'new_test',
        notes: form.notes.trim() || undefined,
        audienceJson,
        placementMode: 'automatic',
        placementsJson: undefined,
        bidStrategy: (() => {
          if (!form.bidStrategy) return undefined
          const parsed = safeParseJson<Record<string, unknown>>(form.bidStrategy, {})
          if ((parsed.strategy === 'COST_CAP' || parsed.strategy === 'BID_CAP') && form.bidAmount) {
            parsed.bidAmount = Number(form.bidAmount)
          }
          if (parsed.strategy === 'MIN_ROAS' && form.roasAverageFloor) {
            parsed.roasAverageFloor = Number(form.roasAverageFloor)
          }
          return parsed
        })(),
      }

      if (form.budgetMode === 'CBO') {
        body.dailyBudget = Number(form.dailyBudget)
      }

      body.adsets = form.adsets.map((adset) => {
        const hasManual = adset.placementMode === 'manual' && adset.placements.length > 0
        const tgt: Record<string, unknown> = {}

        if (adset.interests.length > 0 || adset.includedCustomAudienceIds || adset.excludedCustomAudienceIds || adset.devicePlatform !== 'all') {
          const targeting: Record<string, unknown> = {}
          if (adset.interests.length > 0) {
            targeting.flexibleSpec = [{ interests: adset.interests.map((it) => ({ id: it.id, name: it.name })) }]
          }
          if (adset.includedCustomAudienceIds?.trim()) {
            targeting.customAudienceIds = adset.includedCustomAudienceIds.split(',').map((s) => s.trim()).filter(Boolean)
          }
          if (adset.excludedCustomAudienceIds?.trim()) {
            targeting.excludedCustomAudienceIds = adset.excludedCustomAudienceIds.split(',').map((s) => s.trim()).filter(Boolean)
          }
          if (adset.devicePlatform !== 'all') {
            targeting.devicePlatforms = [adset.devicePlatform]
          }
          tgt.targetingJson = JSON.stringify(targeting)
        }

        const evt = adset.customEventType || (form.objective === 'OUTCOME_LEADS' ? 'LEAD' : form.objective === 'OUTCOME_SALES' ? 'PURCHASE' : undefined)
        const parsedBidStrategy = form.budgetMode === 'ABO' && adset.bidStrategy
          ? (() => {
              const parsed = JSON.parse(adset.bidStrategy) as Record<string, unknown>
              if ((parsed.strategy === 'COST_CAP' || parsed.strategy === 'BID_CAP') && adset.bidAmount) {
                parsed.bidAmount = Number(adset.bidAmount)
              }
              if (parsed.strategy === 'MIN_ROAS' && adset.roasAverageFloor) {
                parsed.roasAverageFloor = Number(adset.roasAverageFloor)
              }
              return parsed
            })()
          : undefined

        return {
          name: adset.name,
          dailyBudget: form.budgetMode === 'ABO' ? Number(adset.dailyBudget) : undefined,
          ...(form.budgetMode === 'ABO' && parsedBidStrategy ? { bidStrategy: parsedBidStrategy } : {}),
          pixelId: adset.pixelId || undefined,
          customEventType: evt || undefined,
          startTime: adset.scheduleMode === 'scheduled' && adset.startTime ? adset.startTime : null,
          endTime: adset.scheduleMode === 'scheduled' && adset.endTime ? adset.endTime : null,
          placementMode: adset.placementMode,
          placements: hasManual ? adset.placements : undefined,
          identityPageId: adset.identityPageId || undefined,
          identityIgUserId: adset.identityIgUserId || undefined,
          audienceJson,
          ...tgt,
          creatives: adset.creatives
            .filter((c) => c.imageUrl.trim() || c.primaryText.trim())
            .map((c, i) => ({
              creativeUrl: c.imageUrl.trim() || undefined,
              linkUrl: c.linkUrl.trim() || undefined,
              primaryText: c.primaryText.trim() || undefined,
              headline: c.headline.trim() || undefined,
              description: c.description.trim() || undefined,
              callToAction: c.callToAction || undefined,
              format: c.format,
              urlTags: c.urlTags?.trim() || undefined,
              childAttachments: c.format === 'carousel' ? safeParseJson<unknown[]>(c.childAttachmentsJson, []) : undefined,
              sortOrder: i,
            })),
        }
      })

      const res = await fetch('/api/admin/test-launches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      const text = await res.text()
      let data: any = null
      try { if (text) data = JSON.parse(text) } catch { /* ignore */ }
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`)

      const newId = data.testLaunch?.id ?? data.id
      router.push(`/test-launches/${newId}`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  function validate(): boolean {
    if (!form.name.trim()) { setSaveError('Nama launch harus diisi.'); return false }
    if (!form.metaConnectionId) { setSaveError('Pilih Meta Connection.'); return false }
    if (!form.metaAdAccountId) { setSaveError('Pilih Ad Account.'); return false }

    if (form.budgetMode === 'CBO') {
      if (!form.dailyBudget || Number(form.dailyBudget) <= 0) { setSaveError('Daily Budget harus lebih dari 0.'); return false }
      if (form.bidStrategy) {
        const parsed = safeParseJson<Record<string, unknown>>(form.bidStrategy, {})
        if ((parsed.strategy === 'COST_CAP' || parsed.strategy === 'BID_CAP') && (!form.bidAmount || Number(form.bidAmount) <= 0)) {
          setSaveError(`Bid amount wajib untuk ${String(parsed.strategy)}.`); return false
        }
        if (parsed.strategy === 'MIN_ROAS' && (!form.roasAverageFloor || Number(form.roasAverageFloor) <= 0)) {
          setSaveError('ROAS floor wajib untuk MIN_ROAS.'); return false
        }
      }
    }

    for (let i = 0; i < form.adsets.length; i++) {
      const a = form.adsets[i]
      if (!a.name.trim()) { setSaveError(`Ad Set #${i + 1}: nama harus diisi.`); return false }
      if (form.budgetMode === 'ABO' && (!a.dailyBudget || Number(a.dailyBudget) <= 0)) {
        setSaveError(`Ad Set "${a.name}": budget harus lebih dari 0.`); return false
      }
      if (a.bidStrategy) {
        const parsed = safeParseJson<Record<string, unknown>>(a.bidStrategy, {})
        if ((parsed.strategy === 'COST_CAP' || parsed.strategy === 'BID_CAP') && (!a.bidAmount || Number(a.bidAmount) <= 0)) {
          setSaveError(`Ad Set "${a.name}": bid amount wajib untuk ${String(parsed.strategy)}.`); return false
        }
        if (parsed.strategy === 'MIN_ROAS' && (!a.roasAverageFloor || Number(a.roasAverageFloor) <= 0)) {
          setSaveError(`Ad Set "${a.name}": ROAS floor wajib untuk MIN_ROAS.`); return false
        }
      }
      if (form.objective === 'OUTCOME_SALES' && !a.pixelId) {
        setSaveError(`Ad Set "${a.name}": pixel wajib untuk Sales objective.`); return false
      }
      if (!a.identityPageId) {
        setSaveError(`Ad Set "${a.name}": pilih Page identity di step Ads.`); return false
      }
      const validCreatives = a.creatives.filter((c) => c.imageUrl.trim() || c.primaryText.trim())
      if (validCreatives.length === 0) {
        setSaveError(`Ad Set "${a.name}": minimal 1 creative.`); return false
      }
      for (const c of validCreatives) {
        if (!c.linkUrl?.trim()) { setSaveError(`Ad Set "${a.name}": linkUrl wajib di setiap creative.`); return false }
        if (c.primaryText?.length > 125) { setSaveError(`Ad Set "${a.name}": primaryText maksimal 125 karakter.`); return false }
        if (c.headline?.length > 255) { setSaveError(`Ad Set "${a.name}": headline maksimal 255 karakter.`); return false }
        if (c.description?.length > 255) { setSaveError(`Ad Set "${a.name}": description maksimal 255 karakter.`); return false }
        if (c.format === 'carousel') {
          const cards = safeParseJson<Array<{ mediaUrl?: string; headline?: string; linkUrl?: string }>>(c.childAttachmentsJson, [])
          if (cards.length < 2) { setSaveError(`Ad Set "${a.name}": carousel minimal 2 card.`); return false }
          if (cards.length > 10) { setSaveError(`Ad Set "${a.name}": carousel maksimal 10 card.`); return false }
        }
      }
    }
    return true
  }

  function safeParseJson<T>(value: string, fallback: T): T {
    try { return value ? JSON.parse(value) : fallback } catch { return fallback }
  }

  // ── Computed ────────────────────────────────────────────────────────────────

  const totalBudget = form.budgetMode === 'CBO'
    ? Number(form.dailyBudget) || 0
    : form.adsets.reduce((s, a) => s + (Number(a.dailyBudget) || 0), 0)

  const creativeCount = form.adsets.reduce((s, a) => s + a.creatives.filter((c) => c.imageUrl.trim() || c.primaryText.trim()).length, 0)

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadingDeps || prefillLoading) {
    return <div className="flex items-center justify-center h-64 text-stone-400 text-sm">Memuat...</div>
  }

  return (
    <div className="max-w-4xl">
      {showStepZero && (
        <StepZeroOverlay
          onChooseProduct={async (pid) => { await applyProductPrefill(pid); setShowStepZero(false) }}
          onChooseEmpty={() => setShowStepZero(false)}
          onClose={() => setShowStepZero(false)}
        />
      )}
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/test-launches" className="text-sm text-stone-400 hover:text-stone-600">← Test Launches</Link>
        </div>
        <h1 className="text-2xl font-bold text-stone-900">New Test Launch</h1>
        <p className="text-sm text-stone-500 mt-0.5">4-step wizard: Campaign → Ad Sets → Ads → Review</p>
      </div>

      {/* Step Indicator */}
      <div className="mb-6">
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-1 flex-1">
              <button
                type="button"
                onClick={() => { if (i <= stepIndex) setCurrentStep(step) }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex-1 justify-center ${
                  i === stepIndex
                    ? 'bg-violet-600 text-white'
                    : i < stepIndex
                    ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                    : 'bg-stone-100 text-stone-400 cursor-default'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                  {i + 1}
                </span>
                <span className="hidden sm:inline">{step}</span>
              </button>
              {i < STEPS.length - 1 && <div className="w-2" />}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── STEP 1: Campaign ──────────────────────────────────────────────── */}
        {currentStep === 'Campaign' && (
          <div className="space-y-5">
            <PageInfo
              purpose="Informasi dasar campaign. Budget diatur campaign-level (CBO) atau per ad set (ABO)."
              inputs={['Nama', 'Meta Connection', 'Ad Account', 'Objective', 'Budget Mode', 'Daily Budget (CBO)']}
              wiring={[
                { label: '→ Ad Sets', desc: 'atur audience, placement, pixel per ad set' },
                { label: '→ Review', desc: 'review sebelum submit' },
              ]}
            />
            <div className={sectionCls}>
              <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">Informasi Campaign</h2>

              {/* Name */}
              <div>
                <label className={labelCls}>Nama Campaign <span className="text-red-500">*</span> {autoSources.campaignName && <span className="inline-flex items-center ml-2 text-[11px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{autoSources.campaignName === 'auto' ? 'auto' : 'auto · ' + autoSources.campaignName.replace(/_/g, ' ').toLowerCase()}</span>}</label>
                <input type="text" value={form.name} onChange={(e) => { setAutoSources((s) => ({ ...s, campaignName: '' })); setForm((f) => ({ ...f, name: e.target.value })) }} required className={inputCls} placeholder="Summer Sale Campaign Q3" />
              </div>

              {/* Budget Mode */}
              <div>
                <label className={labelCls}>Budget Mode</label>
                <div className="flex gap-3">
                  {BUDGET_MODE_OPTIONS.map((opt) => (
                    <label key={opt.value} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                      form.budgetMode === opt.value ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}>
                      <input type="radio" name="budgetMode" value={opt.value} checked={form.budgetMode === opt.value} onChange={() => handleBudgetModeChange(opt.value as 'CBO' | 'ABO')} className="sr-only" />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Meta Connection */}
              <div>
                <label className={labelCls}>Meta Connection <span className="text-red-500">*</span> {autoSources.metaAccountId && <span className="inline-flex items-center ml-2 text-[11px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{autoSources.metaAccountId === 'auto' ? 'auto' : 'auto · ' + autoSources.metaAccountId.replace(/_/g, ' ').toLowerCase()}</span>}</label>
                <select value={form.metaConnectionId} onChange={(e) => handleMetaConnectionChange(e.target.value)} className={inputCls}>
                  <option value="">-- Pilih Meta Connection --</option>
                  {metaConnections.map((mc) => (
                    <option key={mc.id} value={mc.id}>{mc.name ?? mc.appId ?? mc.id} ({mc.status}) — {mc.accountName ?? 'no name'}</option>
                  ))}
                </select>
              </div>

              {/* Ad Account */}
              <div>
                <label className={labelCls}>Ad Account <span className="text-red-500">*</span> {autoSources.metaAdAccountId && <span className="inline-flex items-center ml-2 text-[11px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{autoSources.metaAdAccountId === 'auto' ? 'auto' : 'auto · ' + autoSources.metaAdAccountId.replace(/_/g, ' ').toLowerCase()}</span>}</label>
                {form.metaConnectionId ? (
                  adAccounts.length > 0 ? (
                    <select value={form.metaAdAccountId} onChange={(e) => handleAdAccountChange(e.target.value)} className={inputCls}>
                      <option value="">-- Pilih Ad Account --</option>
                      {adAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.adAccountName ?? acc.adAccountId} ({acc.adAccountId}){acc.currency ? ` · ${acc.currency}` : ''}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-stone-400 py-2">Memuat ad accounts...</p>
                  )
                ) : (
                  <select disabled className={`${inputCls} bg-stone-50 text-stone-400`}><option value="">Pilih Meta Connection terlebih dahulu</option></select>
                )}
              </div>

              {/* Objective */}
              <div>
                <label className={labelCls}>Objective {autoSources.objective && <span className="inline-flex items-center ml-2 text-[11px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{autoSources.objective === 'auto' ? 'auto' : 'auto · ' + autoSources.objective.replace(/_/g, ' ').toLowerCase()}</span>}</label>
                <select value={form.objective} onChange={(e) => { setAutoSources((s) => ({ ...s, objective: '' })); setForm((f) => ({ ...f, objective: e.target.value })) }} className={inputCls}>
                  {OBJECTIVE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>

              {/* Budget */}
              <div>
                {form.budgetMode === 'CBO' ? (
                  <>
                    <label className={labelCls}>Daily Budget (IDR) <span className="text-red-500">*</span></label>
                    <input type="number" value={form.dailyBudget} onChange={(e) => setForm((f) => ({ ...f, dailyBudget: e.target.value }))} required min="1000" step="1000" className={inputCls} placeholder="50000" />
                  </>
                ) : (
                  <>
                    <label className={labelCls}>Daily Budget (IDR)</label>
                    <div className={`${inputCls} bg-stone-50 text-stone-400 flex items-center h-[38px]`}>Budget diisi per ad set</div>
                  </>
                )}
              </div>

              {/* Bid Strategy (CBO campaign-level) */}
              {form.budgetMode === 'CBO' && (
                <div>
                  <label className={labelCls}>Bid Strategy</label>
                  {form.metaAdAccountId ? (
                    bidStrategies.length > 0 ? (
                      <>
                        <select
                          value={form.bidStrategy}
                          onChange={(e) => setForm((f) => ({ ...f, bidStrategy: e.target.value, bidAmount: '', roasAverageFloor: '' }))}
                          className={inputCls}
                        >
                          <option value="">Lowest Cost (default)</option>
                          {bidStrategies.filter((b) => b.available).map((bs) => (
                            <option key={bs.value} value={JSON.stringify({ strategy: bs.value })}>{bs.label}</option>
                          ))}
                        </select>
                        {form.bidStrategy && (() => {
                          const parsed = safeParseJson<Record<string, unknown>>(form.bidStrategy, {})
                          if (parsed.strategy === 'COST_CAP' || parsed.strategy === 'BID_CAP') {
                            return (
                              <div className="mt-2">
                                <label className={labelCls}>Bid Amount</label>
                                <input type="number" value={form.bidAmount} onChange={(e) => setForm((f) => ({ ...f, bidAmount: e.target.value }))} min="1" step="1" className={inputCls} placeholder="20000" />
                                <p className="text-xs text-stone-500 mt-1">Isi angka target bid sesuai currency account.</p>
                              </div>
                            )
                          }
                          if (parsed.strategy === 'MIN_ROAS') {
                            return (
                              <div className="mt-2">
                                <label className={labelCls}>ROAS Average Floor</label>
                                <input type="number" value={form.roasAverageFloor} onChange={(e) => setForm((f) => ({ ...f, roasAverageFloor: e.target.value }))} min="1" step="1" className={inputCls} placeholder="10000" />
                                <p className="text-xs text-stone-500 mt-1">Meta pakai integer. Contoh: 10000 = ROAS 1.0.</p>
                              </div>
                            )
                          }
                          return null
                        })()}
                      </>
                    ) : (
                      <div className={`${inputCls} bg-stone-50 text-stone-400 flex items-center h-[38px]`}>Memuat strategi dari ad account...</div>
                    )
                  ) : (
                    <div className={`${inputCls} bg-stone-50 text-stone-400 flex items-center h-[38px]`}>Pilih Ad Account terlebih dahulu</div>
                  )}
                </div>
              )}
            </div>

            {saveError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">⚠️ {saveError}</div>
            )}

            <div className="flex justify-end gap-3 pb-6">
              <Link href="/test-launches" className="btn-ghost">Batal</Link>
              <button type="button" onClick={() => setCurrentStep('Ad Sets')} className="btn-primary">
                Lanjut ke Ad Sets →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Ad Sets ──────────────────────────────────────────────── */}
        {currentStep === 'Ad Sets' && (
          <div className="space-y-5">
            <PageInfo
              purpose="Atur audience, placement, pixel, dan budget (ABO) per ad set. Bisa duplicate ad set untuk variasi audience."
              inputs={['Nama', 'Budget (ABO)', 'Pixel & Event', 'Audience', 'Placement', 'Targeting']}
              wiring={[
                { label: '→ Ads', desc: 'atur identity & creatives per ad set' },
                { label: '→ Duplicate', desc: 'copy ad set dengan semua field' },
              ]}
            />

            <div className={sectionCls}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">Ad Sets</h2>
                <button type="button" onClick={addAdset} className="btn-primary btn-sm">+ Tambah Ad Set</button>
              </div>

              {form.adsets.map((adset, idx) => {
                const ps = pages.find((p) => p.pageId === adset.identityPageId)
                return (
                  <details key={adset.id} className={cardCls} open>
                    <summary className="text-sm font-semibold text-stone-700 cursor-pointer flex items-center gap-2">
                      <span>Ad Set #{idx + 1}: {adset.name || '(no name)'}</span>
                      <span className="text-xs text-stone-400 font-normal">
                        {form.budgetMode === 'ABO' ? `· Rp${Number(adset.dailyBudget || 0).toLocaleString('id-ID')}/hari` : ''}
                        · {adset.identityPageId ? (ps?.pageName ?? 'Page ✓') : '⚠️ No Page'}
                        · {adset.creatives.length} creative(s)
                      </span>
                    </summary>

                    <div className="mt-4 space-y-3">
                      {/* Name + Delete + Duplicate */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className={labelCls}>Nama Ad Set</label>
                          <input type="text" value={adset.name} onChange={(e) => updateAdsetField(adset.id, 'name', e.target.value)} className={inputCls} placeholder="Ad Set Jawa" />
                        </div>
                        <div className="flex gap-1 items-end pb-1">
                          <button type="button" onClick={() => duplicateAdset(adset.id)} className="text-xs text-violet-600 hover:underline px-2 py-1">Duplicate</button>
                          {form.adsets.length > 1 && (
                            <button type="button" onClick={() => removeAdset(adset.id)} className="text-xs text-red-500 hover:underline px-2 py-1">Hapus</button>
                          )}
                        </div>
                      </div>

                      {/* Budget + Bid Strategy (ABO only) */}
                      {form.budgetMode === 'ABO' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={labelCls}>Daily Budget (IDR)</label>
                            <input type="number" value={adset.dailyBudget} onChange={(e) => updateAdsetField(adset.id, 'dailyBudget', e.target.value)} min="1000" step="1000" className={inputCls} placeholder="30000" />
                          </div>
                          {bidStrategies.length > 0 && (
                            <div>
                              <label className={labelCls}>Bid Strategy (opsional)</label>
                              <select value={adset.bidStrategy} onChange={(e) => updateAdsetField(adset.id, 'bidStrategy', e.target.value)} className={inputCls}>
                                <option value="">Inherit (default)</option>
                                {bidStrategies.filter((b) => b.available).map((bs) => (
                                  <option key={bs.value} value={JSON.stringify({ strategy: bs.value })}>{bs.label}</option>
                                ))}
                              </select>
                              {adset.bidStrategy && (() => {
                                const parsed = safeParseJson<Record<string, unknown>>(adset.bidStrategy, {})
                                if (parsed.strategy === 'COST_CAP' || parsed.strategy === 'BID_CAP') {
                                  return (
                                    <div className="mt-2">
                                      <label className={labelCls}>Bid Amount</label>
                                      <input type="number" value={adset.bidAmount} onChange={(e) => updateAdsetField(adset.id, 'bidAmount', e.target.value)} min="1" step="1" className={inputCls} placeholder="20000" />
                                      <p className="text-xs text-stone-500 mt-1">Isi angka target bid sesuai currency account.</p>
                                    </div>
                                  )
                                }
                                if (parsed.strategy === 'MIN_ROAS') {
                                  return (
                                    <div className="mt-2">
                                      <label className={labelCls}>ROAS Average Floor</label>
                                      <input type="number" value={adset.roasAverageFloor} onChange={(e) => updateAdsetField(adset.id, 'roasAverageFloor', e.target.value)} min="1" step="1" className={inputCls} placeholder="10000" />
                                      <p className="text-xs text-stone-500 mt-1">Meta pakai integer. Contoh: 10000 = ROAS 1.0.</p>
                                    </div>
                                  )
                                }
                                return null
                              })()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pixel + Event */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>Meta Pixel {autoSources.pixelId && <span className="inline-flex items-center ml-2 text-[11px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{autoSources.pixelId === 'auto' ? 'auto' : 'auto · ' + autoSources.pixelId.replace(/_/g, ' ').toLowerCase()}</span>}</label>
                          {pixels.length > 0 ? (
                            <select value={adset.pixelId} onChange={(e) => { setAutoSources((s) => ({ ...s, pixelId: '' })); updateAdsetField(adset.id, 'pixelId', e.target.value) }} className={inputCls}>
                              <option value="">-- Pilih Pixel --</option>
                              {pixels.map((px) => (<option key={px.id} value={px.id}>{px.name}</option>))}
                            </select>
                          ) : (
                            <div className={`${inputCls} bg-stone-50 text-stone-400 flex items-center h-[38px]`}>
                              {form.metaAdAccountId ? 'Pixels not available' : 'Pilih Ad Account dulu'}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className={labelCls}>Custom Event</label>
                          <select value={adset.customEventType} onChange={(e) => updateAdsetField(adset.id, 'customEventType', e.target.value)} className={inputCls}>
                            <option value="">-- Default --</option>
                            {EVENT_OPTIONS.map((evt) => (<option key={evt.value} value={evt.value}>{evt.label}</option>))}
                          </select>
                        </div>
                      </div>

                      {/* Schedule */}
                      <div>
                        <label className={labelCls}>Jadwal</label>
                        <div className="flex gap-3">
                          {(['now', 'scheduled'] as const).map((mode) => (
                            <label key={mode} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                              adset.scheduleMode === mode ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                            }`}>
                              <input type="radio" checked={adset.scheduleMode === mode} onChange={() => updateAdsetField(adset.id, 'scheduleMode', mode)} className="sr-only" />
                              {mode === 'now' ? 'Mulai Sekarang' : 'Jadwalkan'}
                            </label>
                          ))}
                        </div>
                        {adset.scheduleMode === 'scheduled' && (
                          <div className="grid grid-cols-2 gap-4 mt-2">
                            <div>
                              <label className={labelCls}>Start Time</label>
                              <input type="datetime-local" value={adset.startTime} onChange={(e) => updateAdsetField(adset.id, 'startTime', e.target.value)} className={inputCls} />
                            </div>
                            <div>
                              <label className={labelCls}>End Time (opsional)</label>
                              <input type="datetime-local" value={adset.endTime} onChange={(e) => updateAdsetField(adset.id, 'endTime', e.target.value)} className={inputCls} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Audience */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className={labelCls}>Age Min</label>
                          <input type="number" value={adset.ageMin} onChange={(e) => updateAdsetField(adset.id, 'ageMin', Math.max(18, Math.min(65, Number(e.target.value))))} min={18} max={65} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Age Max</label>
                          <input type="number" value={adset.ageMax} onChange={(e) => updateAdsetField(adset.id, 'ageMax', Math.max(18, Math.min(65, Number(e.target.value))))} min={18} max={65} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Gender</label>
                          <select value={adset.gender} onChange={(e) => updateAdsetField(adset.id, 'gender', e.target.value)} className={inputCls}>
                            {GENDER_OPTIONS.map((g) => (<option key={g.value} value={g.value}>{g.label}</option>))}
                          </select>
                        </div>
                      </div>

                      {/* Placement */}
                      <div>
                        <label className={labelCls}>Placement</label>
                        <div className="flex gap-3 mb-2">
                          {(['automatic', 'manual'] as const).map((mode) => (
                            <label key={mode} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                              adset.placementMode === mode ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                            }`}>
                              <input type="radio" checked={adset.placementMode === mode} onChange={() => updateAdsetField(adset.id, 'placementMode', mode)} className="sr-only" />
                              {mode === 'automatic' ? '⚡ Automatic' : '✋ Manual'}
                            </label>
                          ))}
                        </div>
                        {adset.placementMode === 'manual' && (
                          <div className="grid grid-cols-2 gap-2">
                            {PLACEMENT_OPTIONS.map((opt) => {
                              const checked = adset.placements.includes(opt.value)
                              return (
                                <label key={opt.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                                  checked ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                                }`}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => updateAdsetField(adset.id, 'placements',
                                      checked ? adset.placements.filter((p) => p !== opt.value) : [...adset.placements, opt.value]
                                    )}
                                    className="sr-only"
                                  />
                                  {opt.label}
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Device */}
                      <div>
                        <label className={labelCls}>Device</label>
                        <div className="flex gap-3">
                          {DEVICE_OPTIONS.map((opt) => (
                            <label key={opt.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                              adset.devicePlatform === opt.value ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                            }`}>
                              <input type="radio" checked={adset.devicePlatform === opt.value} onChange={() => updateAdsetField(adset.id, 'devicePlatform', opt.value)} className="sr-only" />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <CustomAudienceSelector
                        audiences={customAudiences}
                        includedIds={parseCommaIds(adset.includedCustomAudienceIds)}
                        excludedIds={parseCommaIds(adset.excludedCustomAudienceIds)}
                        error={customAudienceError}
                        onIncludeToggle={(id) => {
                          const inc = parseCommaIds(adset.includedCustomAudienceIds)
                          if (inc.includes(id)) {
                            updateAdsetField(adset.id, 'includedCustomAudienceIds', inc.filter((i) => i !== id).join(','))
                          } else {
                            // also remove from exclude
                            const exc = parseCommaIds(adset.excludedCustomAudienceIds)
                            updateAdsetField(adset.id, 'excludedCustomAudienceIds', exc.filter((i) => i !== id).join(','))
                            updateAdsetField(adset.id, 'includedCustomAudienceIds', [...inc, id].join(','))
                          }
                        }}
                        onExcludeToggle={(id) => {
                          const exc = parseCommaIds(adset.excludedCustomAudienceIds)
                          if (exc.includes(id)) {
                            updateAdsetField(adset.id, 'excludedCustomAudienceIds', exc.filter((i) => i !== id).join(','))
                          } else {
                            const inc = parseCommaIds(adset.includedCustomAudienceIds)
                            updateAdsetField(adset.id, 'includedCustomAudienceIds', inc.filter((i) => i !== id).join(','))
                            updateAdsetField(adset.id, 'excludedCustomAudienceIds', [...exc, id].join(','))
                          }
                        }}
                        onManualIncludeIds={(ids) => updateAdsetField(adset.id, 'includedCustomAudienceIds', ids)}
                        onManualExcludeIds={(ids) => updateAdsetField(adset.id, 'excludedCustomAudienceIds', ids)}
                      />

                      {/* Interests */}
                      <InterestSearch
                        value={adset.interests}
                        metaConnectionId={form.metaConnectionId}
                        onAdd={(interest) => addInterest(adset.id, interest)}
                        onRemove={(interestId) => removeInterest(adset.id, interestId)}
                      />
                    </div>
                  </details>
                )
              })}

              <div className="bg-violet-50 rounded-lg p-4 text-sm">
                <p className="text-xs font-semibold text-violet-600 uppercase mb-1">Total Budget</p>
                <p className="text-lg font-bold text-violet-700">Rp{totalBudget.toLocaleString('id-ID')} /hari</p>
              </div>
            </div>

            <div className="flex justify-between gap-3 pb-6">
              <button type="button" onClick={() => setCurrentStep('Campaign')} className="btn-ghost">← Kembali</button>
              <button type="button" onClick={() => setCurrentStep('Ads')} className="btn-primary">Lanjut ke Ads →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Ads ──────────────────────────────────────────────────── */}
        {currentStep === 'Ads' && (
          <div className="space-y-5">
            <PageInfo
              purpose="Tentukan Facebook Page + Instagram identity dan creatives per ad set."
              inputs={['Identity (Page + IG)', 'Creative per ad set', 'Image URL', 'Primary Text', 'Headline', 'CTA']}
              wiring={[
                { label: '→ Review', desc: 'cek semua sebelum submit' },
                { label: '→ Copy creatives', desc: 'duplikasi cepat antar ad set' },
              ]}
            />
            <div className={sectionCls}>
              <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">Identity & Creatives</h2>
              <p className="text-xs text-stone-500">Pilih Page identity yang akan digunakan untuk semua iklan. Tiap ad set bisa punya creatives sendiri.</p>

              {/* Identity selector */}
              <div>
                <label className={labelCls}>Facebook Page Identity {autoSources.pageId && <span className="inline-flex items-center ml-2 text-[11px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{autoSources.pageId === 'auto' ? 'auto' : 'auto · ' + autoSources.pageId.replace(/_/g, ' ').toLowerCase()}</span>}</label>
                {availablePages.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availablePages.map((page) => (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => handleSelectPage(page)}
                        className={`text-left p-4 rounded-xl border-2 transition-all ${
                          selectedPage?.id === page.id ? 'border-violet-500 bg-violet-50' : 'border-stone-200 hover:border-violet-300 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-stone-900 text-sm truncate">{page.pageName ?? page.pageId}</p>
                            <p className="text-xs text-stone-400 font-mono truncate">{page.pageId}</p>
                          </div>
                        </div>
                        {page.igBusinessAccountId && (
                          <div className="text-xs text-pink-600">Instagram: @{page.igUsername}</div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-stone-400 py-2">Pilih Meta Connection di step Campaign terlebih dahulu.</p>
                )}
              </div>

              {/* Creatives per adset */}
              {form.adsets.map((adset, idx) => (
                <div key={adset.id} className={cardCls}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-stone-700">Creatives — Ad Set #{idx + 1}: {adset.name}</h3>
                    <button type="button" onClick={() => addCreativeToAdset(adset.id)} className="btn-primary btn-sm">+ Creative</button>
                  </div>

                  {adset.creatives.map((creative, ci) => (
                    <div key={creative.id} className="border border-stone-200 rounded-lg p-4 bg-stone-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-500 uppercase">Creative #{ci + 1}</span>
                        {adset.creatives.length > 1 && (
                          <button type="button" onClick={() => removeCreativeFromAdset(adset.id, creative.id)} className="text-xs text-red-500 hover:underline">Hapus</button>
                        )}
                      </div>

                      {/* Format */}
                      <div className="flex gap-3">
                        {(['single', 'carousel'] as const).map((fmt) => (
                          <label key={fmt} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-xs ${
                            creative.format === fmt ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-stone-200 text-stone-600'
                          }`}>
                            <input type="radio" checked={creative.format === fmt} onChange={() => updateCreativeField(adset.id, creative.id, 'format', fmt)} className="sr-only" />
                            {fmt === 'single' ? 'Single' : 'Carousel'}
                          </label>
                        ))}
                      </div>

                      {/* Media URL with picker */}
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <label className={labelCls}>Media <span className="text-red-500">*</span></label>
                          <button
                            type="button"
                            onClick={() => {
                              const key = adset.id + '__' + creative.id
                              const next = !(showPicker.get(key) ?? false)
                              setShowPicker(new Map(showPicker.set(key, next)))
                            }}
                            className="text-xs text-violet-700 hover:underline"
                          >
                            {(showPicker.get(adset.id + '__' + creative.id) ?? false) ? 'Input URL manual' : 'Pilih dari Media Library'}
                          </button>
                        </div>

                        {showPicker.get(adset.id + '__' + creative.id) ? (
                          <div className="border border-stone-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                            {mediaAssets.length === 0 ? (
                              <p className="text-xs text-stone-500">Tidak ada asset siap pakai di Media Library</p>
                            ) : (
                              <div className="grid grid-cols-4 gap-2">
                                {mediaAssets.filter((a) => a.type === 'IMAGE').map((asset) => (
                                  <button
                                    key={asset.id}
                                    type="button"
                                    title={asset.label ?? asset.fileUrl ?? undefined}
                                    onClick={() => updateCreativeField(adset.id, creative.id, 'imageUrl', asset.fileUrl || asset.publicUrl || '')}
                                    className={`aspect-square rounded-lg border-2 overflow-hidden hover:border-violet-500 transition-all ${
                                      creative.imageUrl === (asset.fileUrl || asset.publicUrl) ? 'border-violet-500 ring-2 ring-violet-300' : 'border-stone-200'
                                    }`}
                                  >
                                    {asset.thumbnailUrl || asset.publicUrl ? (
                                      <img src={asset.thumbnailUrl || asset.publicUrl || undefined} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full bg-stone-100 flex items-center justify-center text-stone-400 text-xs">IMG</div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <input type="url" value={creative.imageUrl} onChange={(e) => updateCreativeField(adset.id, creative.id, 'imageUrl', e.target.value)} className={inputCls} placeholder="https://..." />
                        )}
                      </div>

                      {/* Link URL */}
                      <div>
                        <label className={labelCls}>Website URL <span className="text-red-500">*</span></label>
                        <input type="url" value={creative.linkUrl} onChange={(e) => updateCreativeField(adset.id, creative.id, 'linkUrl', e.target.value)} className={inputCls} placeholder="https://..." />
                      </div>

                      {/* Text fields with live char counters */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between">
                            <label className={labelCls}>Primary Text <span className="text-red-500">*</span></label>
                            <span className={`text-xs font-mono ${
                              creative.primaryText.length > 125 ? 'text-red-600 font-bold' :
                              creative.primaryText.length > 112 ? 'text-amber-600' : 'text-stone-400'
                            }`}>{creative.primaryText.length}/125</span>
                          </div>
                          <textarea value={creative.primaryText} onChange={(e) => updateCreativeField(adset.id, creative.id, 'primaryText', e.target.value)} rows={2} className={`${inputCls} resize-none ${creative.primaryText.length > 125 ? 'border-red-400 ring-red-300' : ''}`} placeholder="Primary text..." />
                          {creative.primaryText.length > 125 && <p className="text-xs text-red-500 mt-0.5">Maksimal 125 karakter. Iklan akan ditolak Meta.</p>}
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className={labelCls}>Headline {creative.headline.length > 0}</label>
                            <span className={`text-xs font-mono ${
                              creative.headline.length > 255 ? 'text-red-600 font-bold' :
                              creative.headline.length > 230 ? 'text-amber-600' : 'text-stone-400'
                            }`}>{creative.headline.length}/255</span>
                          </div>
                          <input type="text" value={creative.headline} onChange={(e) => updateCreativeField(adset.id, creative.id, 'headline', e.target.value)} className={`${inputCls} ${creative.headline.length > 255 ? 'border-red-400 ring-red-300' : ''}`} placeholder="Headline..." />
                          {creative.headline.length > 255 && <p className="text-xs text-red-500 mt-0.5">Maksimal 255 karakter. Iklan akan ditolak Meta.</p>}
                          <p className="text-xs text-stone-400 mt-0.5">Optimal ≤40 karakter — lebih dari ini kepotong di feed</p>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label className={labelCls}>Description (opsional)</label>
                          <span className={`text-xs font-mono ${
                            creative.description.length > 255 ? 'text-red-600 font-bold' :
                            creative.description.length > 230 ? 'text-amber-600' : 'text-stone-400'
                          }`}>{creative.description.length}/255</span>
                        </div>
                        <textarea value={creative.description} onChange={(e) => updateCreativeField(adset.id, creative.id, 'description', e.target.value)} rows={2} className={`${inputCls} resize-none ${creative.description.length > 255 ? 'border-red-400 ring-red-300' : ''}`} placeholder="Description..." />
                        {creative.description.length > 255 && <p className="text-xs text-red-500 mt-0.5">Maksimal 255 karakter</p>}
                        <p className="text-xs text-stone-400 mt-0.5">Optimal ≤30 karakter — lebih dari ini kepotong di feed</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>Call to Action</label>
                          <select value={creative.callToAction} onChange={(e) => updateCreativeField(adset.id, creative.id, 'callToAction', e.target.value)} className={inputCls}>
                            {CTA_OPTIONS.map((cta) => (<option key={cta.value} value={cta.value}>{cta.label}</option>))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>URL Tags (opsional)</label>
                          <input type="text" value={creative.urlTags} onChange={(e) => updateCreativeField(adset.id, creative.id, 'urlTags', e.target.value)} className={inputCls} placeholder="utm_source=fb&utm_campaign=..." />
                        </div>
                      </div>

                                            {!creative.format?.startsWith('carousel') && (
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            disabled={!prefillProductId || copyLoadingKey === (adset.id + '__' + creative.id)}
                            title={!prefillProductId ? 'Pilih Dari Produk dulu untuk generate copy' : ''}
                            onClick={() => generateCopyForCreative(adset.id, creative.id)}
                            className={"text-xs font-semibold px-3 py-2 rounded-lg border " + (!prefillProductId ? 'border-stone-200 text-stone-400 cursor-not-allowed' : 'border-violet-300 text-violet-700 hover:bg-violet-50')}
                          >
                            {copyLoadingKey === (adset.id + '__' + creative.id) ? 'Generating...' : '✨ Generate copy'}
                          </button>
                          {copyVariants[adset.id + '__' + creative.id]?.length ? (
                            <div className="flex flex-wrap gap-2 justify-end">
                              {copyVariants[adset.id + '__' + creative.id].map((variant, vi) => (
                                <button
                                  key={vi}
                                  type="button"
                                  onClick={() => applyCopyVariant(adset.id, creative.id, variant)}
                                  className="px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 text-xs font-medium hover:bg-violet-200"
                                >
                                  Variant {vi + 1}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {creative.format === 'carousel' && (() => {
                        const cards: Array<{mediaUrl: string; headline: string; linkUrl: string}> = (() => {
                          try { const p = JSON.parse(creative.childAttachmentsJson || '[]'); return Array.isArray(p) ? p : [] }
                          catch { return [] }
                        })()
                        return (
                        <div className="space-y-3 border border-stone-200 rounded-lg p-4 bg-white">
                          <div className="flex items-center justify-between">
                            <label className={labelCls}>Carousel Cards <span className="text-red-500">*</span></label>
                            <button
                              type="button"
                              disabled={cards.length >= 10}
                              onClick={() => {
                                const next = [...cards, { mediaUrl: '', headline: '', linkUrl: '' }]
                                updateCreativeField(adset.id, creative.id, 'childAttachmentsJson', JSON.stringify(next))
                              }}
                              className="text-xs text-violet-700 hover:underline disabled:text-stone-400 disabled:cursor-not-allowed"
                            >+ Card</button>
                          </div>

                          {cards.length === 0 && <p className="text-xs text-stone-400">Belum ada card. Klik "+ Card" untuk memulai. Minimum 2 card untuk carousel.</p>}
                          {cards.map((card, ci) => (
                            <div key={ci} className="border border-stone-200 rounded-lg p-3 space-y-2 bg-stone-50">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-stone-500 uppercase">Card #{ci + 1}</span>
                                <button type="button" onClick={() => {
                                  const next = cards.filter((_, i) => i !== ci)
                                  updateCreativeField(adset.id, creative.id, 'childAttachmentsJson', JSON.stringify(next))
                                }} className="text-xs text-red-500 hover:underline">Hapus</button>
                              </div>
                              <div>
                                <label className={labelCls}>Media URL <span className="text-red-500">*</span></label>
                                <input type="url" value={card.mediaUrl} onChange={(e) => {
                                  const next = cards.map((c, i) => i === ci ? { ...c, mediaUrl: e.target.value } : c)
                                  updateCreativeField(adset.id, creative.id, 'childAttachmentsJson', JSON.stringify(next))
                                }} className={inputCls} placeholder="https://..." />
                              </div>
                              <div>
                                <label className={labelCls}>Headline</label>
                                <input type="text" value={card.headline} onChange={(e) => {
                                  const next = cards.map((c, i) => i === ci ? { ...c, headline: e.target.value } : c)
                                  updateCreativeField(adset.id, creative.id, 'childAttachmentsJson', JSON.stringify(next))
                                }} className={inputCls} placeholder="Judul card..." maxLength={255} />
                              </div>
                              <div>
                                <label className={labelCls}>Link URL</label>
                                <input type="url" value={card.linkUrl} onChange={(e) => {
                                  const next = cards.map((c, i) => i === ci ? { ...c, linkUrl: e.target.value } : c)
                                  updateCreativeField(adset.id, creative.id, 'childAttachmentsJson', JSON.stringify(next))
                                }} className={inputCls} placeholder="https://..." />
                              </div>
                            </div>
                          ))}
                          {cards.length >= 2 && cards.length <= 10 && (
                            <p className="text-xs text-stone-500">{cards.length} card — cukup untuk carousel.</p>
                          )}
                        </div>
                        )
                      })()}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="flex justify-between gap-3 pb-6">
              <button type="button" onClick={() => setCurrentStep('Ad Sets')} className="btn-ghost">← Kembali</button>
              <button type="button" onClick={() => setCurrentStep('Review')} className="btn-primary">Lanjut ke Review →</button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Review ──────────────────────────────────────────────── */}
        {currentStep === 'Review' && (() => {
          const mc = metaConnections.find((m) => m.id === form.metaConnectionId)
          const adAct = adAccounts.find((a) => a.id === form.metaAdAccountId)
          const hasCharErrors = form.adsets.some((a) =>
            a.creatives.some((c) =>
              c.primaryText.length > 125 || c.headline.length > 255 || c.description.length > 255
            )
          )
          const pixelErrors = form.adsets.filter((a) => form.objective === 'OUTCOME_SALES' && !a.pixelId)

          return (
          <div className="space-y-5">
            <PageInfo
              purpose="Review semua data sebelum submit. Pastikan badge merah tidak ada."
              inputs={['Campaign', 'Ad Sets', 'Creatives']}
              wiring={[
                { label: '→ Submit', desc: 'POST /api/admin/test-launches' },
                { label: '→ Detail page', desc: 'redirect setelah berhasil' },
              ]}
            />

            <div className={sectionCls}>
              <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">Review</h2>

              {/* ── Campaign Section ─── */}
              <div className="border border-stone-200 rounded-xl p-5 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-lg font-bold text-violet-700">{form.name || '(no name)'}</p>
                  {hasCharErrors && <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-semibold">⚠ Karakter overflow</span>}
                  {pixelErrors.length > 0 && <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-semibold">⚠ {pixelErrors.length} ad set tanpa pixel (SALES)</span>}
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-stone-600">
                  <div><span className="text-stone-400">Connection:</span> {mc?.name ?? mc?.appId ?? form.metaConnectionId}</div>
                  <div><span className="text-stone-400">Ad Account:</span> {adAct?.adAccountName ?? form.metaAdAccountId} ({adAct?.adAccountId ?? '—'})</div>
                  <div><span className="text-stone-400">Objective:</span> {OBJECTIVE_OPTIONS.find((o) => o.value === form.objective)?.label}</div>
                  <div><span className="text-stone-400">Budget Mode:</span> {form.budgetMode}</div>
                  {form.budgetMode === 'CBO' && (
                    <>
                      <div className="text-base font-bold text-violet-600">Rp{Number(form.dailyBudget).toLocaleString('id-ID')}/hari</div>
                      <div><span className="text-stone-400">Bid:</span> {(() => { try { const p = JSON.parse(form.bidStrategy || '{}'); return p.strategy || 'Lowest Cost' } catch { return 'Lowest Cost' } })()}</div>
                    </>
                  )}
                  <div><span className="text-stone-400">Ad Sets:</span> <span className="text-base font-bold text-stone-800">{form.adsets.length}</span></div>
                  <div><span className="text-stone-400">Creatives:</span> <span className="text-base font-bold text-stone-800">{creativeCount}</span></div>
                  <div><span className="text-stone-400">Budget:</span> <span className="text-base font-bold text-violet-600">Rp{totalBudget.toLocaleString('id-ID')}/hari</span></div>
                </div>
              </div>

              {form.adsets.map((adset, idx) => {
                const ps = pages.find((p) => p.pageId === adset.identityPageId)
                const ac = adset.creatives.filter((c) => c.imageUrl.trim() || c.primaryText.trim())
                const parsedBid = adset.bidStrategy ? (() => { try { return JSON.parse(adset.bidStrategy) as Record<string, string> } catch { return null } })() : null
                const incCa = parseCommaIds(adset.includedCustomAudienceIds)
                const excCa = parseCommaIds(adset.excludedCustomAudienceIds)
                const missingPixel = form.objective === 'OUTCOME_SALES' && !adset.pixelId
                return (
                  <div key={adset.id} className="border border-stone-200 rounded-xl p-5 space-y-3">
                    {/* Ad Set header */}
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-stone-800">Ad Set #{idx + 1}: {adset.name}</p>
                      {missingPixel && <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-semibold">⚠ Pixel kosong (SALES)</span>}
                    </div>

                    {/* Identity & Account details */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-stone-600">
                      <div><span className="text-stone-400">Page:</span> {(ps?.pageName ?? adset.identityPageId) || '—'}</div>
                      {ps?.igUsername && <div><span className="text-stone-400">IG:</span> @{ps.igUsername}</div>}
                      {form.budgetMode === 'ABO' && <div><span className="text-stone-400">Budget:</span> <span className="font-semibold">Rp{Number(adset.dailyBudget || 0).toLocaleString('id-ID')}/hari</span></div>}
                      <div><span className="text-stone-400">Pixel:</span> {adset.pixelId ? `${adset.pixelId} · ${adset.customEventType || '—'}` : '—'}</div>
                      {parsedBid && <div><span className="text-stone-400">Bid:</span> {parsedBid.strategy}</div>}
                      <div><span className="text-stone-400">Schedule:</span> {adset.scheduleMode === 'scheduled' ? `${adset.startTime || '—'} → ${adset.endTime || '—'}` : 'Terus-menerus'}</div>
                    </div>

                    {/* Audience targeting summary */}
                    <div className="bg-stone-50 rounded-lg p-3 space-y-1 text-xs text-stone-600">
                      <p><span className="text-stone-400">Target:</span> {adset.ageMin}–{adset.ageMax} th · {GENDER_OPTIONS.find((g) => g.value === adset.gender)?.label} · {DEVICE_OPTIONS.find((d) => d.value === adset.devicePlatform)?.label}</p>
                      <p><span className="text-stone-400">Placement:</span> {adset.placementMode === 'manual' ? `Manual (${adset.placements.length} selected)` : '⚡ Automatic'}</p>
                      {adset.interests.length > 0 && <p><span className="text-stone-400">Interests:</span> {adset.interests.length} selected</p>}
                      {incCa.length > 0 && <p><span className="text-stone-400">CA include:</span> {incCa.length}</p>}
                      {excCa.length > 0 && <p><span className="text-stone-400">CA exclude:</span> {excCa.length}</p>}
                      <p><span className="text-stone-400">Creatives:</span> <span className="font-semibold text-violet-700">{ac.length}</span></p>
                    </div>

                    {/* Creative previews */}
                    {ac.map((c, ci) => (
                      <div key={c.id} className="flex items-start gap-3 border border-stone-100 rounded-lg p-3 bg-white">
                        <div className="w-12 h-12 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0">
                          {c.imageUrl ? (
                            <img src={c.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.classList.add('flex', 'items-center', 'justify-center', 'text-stone-400', 'text-xs') }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs">—</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-stone-500">#{ci + 1}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              c.format === 'carousel' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                            }`}>{c.format === 'carousel' ? 'Carousel' : 'Single'}</span>
                            {c.primaryText.length > 125 && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">text overflow</span>}
                          </div>
                          <p className="text-xs text-stone-600 truncate mt-0.5">
                            {c.primaryText ? `"${c.primaryText.slice(0, 60)}${c.primaryText.length > 60 ? '...' : ''}"` : '—'}
                          </p>
                          {c.headline && (
                            <p className="text-[11px] text-stone-400 truncate">[{c.headline.slice(0, 50)}{c.headline.length > 50 ? '...' : ''}]</p>
                          )}
                          <p className="text-[11px] text-stone-400 truncate">{c.linkUrl ? (c.linkUrl.length > 50 ? c.linkUrl.slice(0, 50) + '...' : c.linkUrl) : '❌ No link'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}

              {saveError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">⚠️ {saveError}</div>
              )}
            </div>

            <div className="flex justify-between gap-3 pb-6">
              <button type="button" onClick={() => setCurrentStep('Ads')} className="btn-ghost">← Kembali</button>
              <div className="flex gap-2">
                <Link href="/test-launches" className="btn-ghost">Batal</Link>
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                  {saving ? 'Menyimpan...' : 'Submit Launch →'}
                </button>
              </div>
            </div>
          </div>
          )
        })()}
      </form>
    </div>
  )
}

// ─── Custom Audience Selector ───────────────────────────────────────────────

function CustomAudienceSelector({
  audiences,
  includedIds,
  excludedIds,
  error,
  onIncludeToggle,
  onExcludeToggle,
  onManualIncludeIds,
  onManualExcludeIds,
}: {
  audiences: CustomAudienceOption[]
  includedIds: string[]
  excludedIds: string[]
  error: string | null
  onIncludeToggle: (id: string) => void
  onExcludeToggle: (id: string) => void
  onManualIncludeIds: (value: string) => void
  onManualExcludeIds: (value: string) => void
}) {
  const [showManual, setShowManual] = useState(false)
  const byId = new Map(audiences.map((a) => [a.id, a]))
  const includePool = audiences.filter((a) => !excludedIds.includes(a.id) && !includedIds.includes(a.id))
  const excludePool = audiences.filter((a) => !includedIds.includes(a.id) && !excludedIds.includes(a.id))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <label className={labelCls}>Custom Audiences</label>
          <p className="text-xs text-stone-500">Klik audience untuk masuk ke include atau exclude. Payload tetap kirim ID yang sama.</p>
        </div>
        <button type="button" onClick={() => setShowManual((v) => !v)} className="text-xs text-violet-700 hover:underline">
          {showManual ? 'Sembunyikan input ID manual' : 'input ID manual'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          custom audience tidak bisa dimuat
          <div className="text-xs mt-1 break-words">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-violet-700">Include</p>
            <p className="text-xs text-stone-500">Audience ini tidak akan muncul di pilihan exclude.</p>
          </div>
          <div className="border border-violet-100 bg-white rounded-lg max-h-40 overflow-y-auto">
            {includePool.length === 0 ? (
              <p className="px-3 py-2 text-xs text-stone-400">Tidak ada audience tersedia</p>
            ) : includePool.map((audience) => (
              <button
                key={audience.id}
                type="button"
                onClick={() => onIncludeToggle(audience.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50 border-b border-stone-100 last:border-0"
              >
                <span className="font-medium">{audience.name}</span>
                {audience.approximateCount ? <span className="text-xs text-stone-400 ml-2">(~{audience.approximateCount.toLocaleString('id-ID')})</span> : null}
              </button>
            ))}
          </div>
          {includedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {includedIds.map((id) => {
                const audience = byId.get(id)
                return (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-700 text-xs rounded-full">
                    {audience?.name ?? id}
                    {audience?.approximateCount ? <span className="text-violet-500">~{audience.approximateCount.toLocaleString('id-ID')}</span> : null}
                    <button type="button" onClick={() => onIncludeToggle(id)} className="text-violet-400 hover:text-violet-700">&times;</button>
                  </span>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-red-700">Exclude</p>
            <p className="text-xs text-stone-500">Audience ini tidak akan muncul di pilihan include.</p>
          </div>
          <div className="border border-red-100 bg-white rounded-lg max-h-40 overflow-y-auto">
            {excludePool.length === 0 ? (
              <p className="px-3 py-2 text-xs text-stone-400">Tidak ada audience tersedia</p>
            ) : excludePool.map((audience) => (
              <button
                key={audience.id}
                type="button"
                onClick={() => onExcludeToggle(audience.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 border-b border-stone-100 last:border-0"
              >
                <span className="font-medium">{audience.name}</span>
                {audience.approximateCount ? <span className="text-xs text-stone-400 ml-2">(~{audience.approximateCount.toLocaleString('id-ID')})</span> : null}
              </button>
            ))}
          </div>
          {excludedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {excludedIds.map((id) => {
                const audience = byId.get(id)
                return (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                    {audience?.name ?? id}
                    {audience?.approximateCount ? <span className="text-red-500">~{audience.approximateCount.toLocaleString('id-ID')}</span> : null}
                    <button type="button" onClick={() => onExcludeToggle(id)} className="text-red-400 hover:text-red-700">&times;</button>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {(showManual || !!error || audiences.length === 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Included Custom Audience IDs (manual)</label>
            <input type="text" value={includedIds.join(',')} onChange={(e) => onManualIncludeIds(e.target.value)} className={inputCls} placeholder="123456789,987654321" />
          </div>
          <div>
            <label className={labelCls}>Excluded Custom Audience IDs (manual)</label>
            <input type="text" value={excludedIds.join(',')} onChange={(e) => onManualExcludeIds(e.target.value)} className={inputCls} placeholder="123456789,987654321" />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Interest Search sub-component ──────────────────────────────────────────

function InterestSearch({
  value,
  metaConnectionId,
  onAdd,
  onRemove,
}: {
  value: Array<{id: string; name: string; audienceSizeLowerBound?: number}>
  metaConnectionId: string
  onAdd: (interest: {id: string; name: string; audienceSizeLowerBound?: number}) => void
  onRemove: (interestId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{id: string; name: string; audience_size_lower_bound?: number}>>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!query.trim() || !metaConnectionId) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/meta-tools/interest-search?q=${encodeURIComponent(query.trim())}&metaAccountId=${metaConnectionId}`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setResults(data.interests ?? [])
        } else {
          setError('Interest search tidak tersedia')
          setResults([])
        }
      } catch {
        setError('Interest search tidak tersedia')
        setResults([])
      }
      setSearching(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [query, metaConnectionId])

  const already = new Set(value.map((i) => i.id))
  const combinedEstimate = value.reduce((sum, interest) => sum + (interest.audienceSizeLowerBound || 0), 0)

  return (
    <div className="space-y-3 w-full">
      <div>
        <label className={labelCls}>Detailed Targeting — Interests</label>
        <p className="text-xs text-stone-500">Cari interest, pilih dari list, lalu review estimasi kasar audience size di bawah.</p>
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={inputCls}
        placeholder="Cari interest... (ketik minimal 2 huruf)"
      />
      {searching && <p className="text-xs text-stone-400 mt-1">Mencari...</p>}
      {error && <p className="text-xs text-amber-600 mt-1">{error}</p>}
      {results.length > 0 && (
        <div className="mt-1 border border-stone-200 rounded-lg max-h-48 overflow-y-auto w-full">
          {results.filter((r) => !already.has(r.id)).slice(0, 12).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { onAdd({ id: r.id, name: r.name, audienceSizeLowerBound: r.audience_size_lower_bound }); setQuery(''); setResults([]) }}
              className="w-full flex items-center justify-between gap-3 text-left px-3 py-2 text-sm hover:bg-violet-50 border-b border-stone-100 last:border-0"
            >
              <span className="font-medium text-stone-800">{r.name}</span>
              <span className="text-xs text-stone-400 whitespace-nowrap">~{formatAudienceSize(r.audience_size_lower_bound)}</span>
            </button>
          ))}
        </div>
      )}
      {value.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5 mt-2">
            {value.map((interest) => (
              <span key={interest.id} className="inline-flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-700 text-xs rounded-full">
                {interest.name}
                <span className="text-violet-500">~{formatAudienceSize(interest.audienceSizeLowerBound)}</span>
                <button type="button" onClick={() => onRemove(interest.id)} className="text-violet-400 hover:text-violet-700">&times;</button>
              </span>
            ))}
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
            <span className="font-semibold text-stone-800">Estimasi gabungan: ~{formatAudienceSize(combinedEstimate)}</span>
            <span className="ml-2">estimasi kasar, bukan reach Meta</span>
          </div>
        </div>
      )}
    </div>
  )
}
