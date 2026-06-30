import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function fmtIdr(n: number): string {
  if (n >= 1_000_000) return `Rp${(n / 1_000_000).toFixed(2).replace('.', ',')}jt`
  if (n >= 1_000) return `Rp${Math.round(n / 1_000)}rb`
  return `Rp${Math.round(n)}`
}

// ─── Ad-test leader by success metric ───
const HIB_METRICS = new Set(['ROAS', 'CTR', 'CVR'])
interface TestVariantMetrics {
  roas: number | null; ctr: number | null; cpc: number | null; cpl: number | null
  cplc: number | null; cpm: number | null; convRate: number | null; costPerLpv: number | null
  spend: number; purchases: number
}
function testMetricValue(v: TestVariantMetrics, m: string): number | null {
  switch (m) {
    case 'ROAS': return v.roas
    case 'CTR': return v.ctr
    case 'CVR': return v.convRate
    case 'CPC': return v.cpc
    case 'CPL': return v.cpl
    case 'CPLC': return v.cplc
    case 'CPM': return v.cpm
    case 'COST_PER_LPV': return v.costPerLpv
    case 'CPA': return v.spend > 0 && v.purchases > 0 ? v.spend / v.purchases : null
    default: return v.roas
  }
}
function fmtTestMetric(val: number | null, m: string): string {
  if (val === null) return '—'
  if (m === 'ROAS') return val.toFixed(1) + 'x'
  if (m === 'CTR' || m === 'CVR') return val.toFixed(1) + '%'
  return fmtIdr(val)
}
function pickTestLeader<T extends TestVariantMetrics & { status: string }>(variants: T[], m: string): T | undefined {
  const declared = variants.find(v => v.status === 'winner')
  if (declared) return declared
  const ranked = variants
    .filter(v => testMetricValue(v, m) !== null)
    .sort((a, b) => {
      const av = testMetricValue(a, m) as number
      const bv = testMetricValue(b, m) as number
      return HIB_METRICS.has(m) ? bv - av : av - bv
    })
  return ranked[0] ?? variants[0]
}

async function getDashboardData() {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  try {
    const [todaySnapshots, runningCampaigns, pendingApprovals, pendingActions, monitors, runningTests, winnerTests, workers, session] =
      await Promise.all([
        prisma.metricSnapshot.findMany({
          where: { entityType: 'CAMPAIGN', windowEnd: { gte: startOfDay } },
          orderBy: { windowEnd: 'desc' },
          select: { metaEntityId: true, spend: true, roas: true, purchaseValue: true },
          take: 500,
        }),
        prisma.campaignSession.count({ where: { status: 'RUNNING' } }),
        prisma.approvalRequest.findMany({
          where: { status: 'pending' },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, createdAt: true, testLaunch: { select: { name: true } } },
        }),
        prisma.automationAction.findMany({
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, actionType: true, source: true, createdAt: true },
        }),
        prisma.postingMonitor.findMany({
          select: {
            status: true,
            lastPostAt: true,
            instagramAccount: { select: { id: true, username: true } },
          },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.adTest.findMany({
          where: { status: 'RUNNING' },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true, name: true, type: true, successMetric: true, createdAt: true,
            variants: {
              select: { id: true, label: true, name: true, status: true, roas: true,
                        spend: true, purchases: true, ctr: true, cpc: true, cpl: true,
                        cplc: true, cpm: true, convRate: true, costPerLpv: true },
            },
          },
        }),
        prisma.adTest.findMany({
          where: { status: 'WINNER_DECLARED' },
          orderBy: { endedAt: 'desc' },
          take: 5,
          select: {
            id: true, name: true, type: true, successMetric: true, endedAt: true,
            winnerVariantId: true,
            variants: {
              select: { id: true, label: true, name: true, status: true, roas: true,
                        spend: true, purchases: true, ctr: true, cpc: true, cpl: true,
                        cplc: true, cpm: true, convRate: true, costPerLpv: true },
            },
          },
        }),
        // Zero-worker: no worker registry — all ops direct/SaaS
        Promise.resolve(null),
        // Get current session user for onboarding checklist
        (async () => {
          const { cookies } = await import('next/headers')
          const cookieStore = cookies()
          const sessionToken = cookieStore.get('hermes_session')?.value
          if (!sessionToken) return null
          const session = await prisma.session.findUnique({
            where: { token: sessionToken },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  role: true,
                  emailVerified: true,
                  createdAt: true,
                  _count: {
                    select: {
                      products: true,
                      metaAccounts: true,
                      campaignSessions: true,
                      generatedMedia: true,
                      instagramAccounts: true,
                      adTests: true,
                    },
                  },
                },
              },
            },
          })
          return session
        })(),
      ])

    // Onboarding checklist
    let onboardingItems: { label: string; done: boolean; href: string }[] | null = null
    const user = session?.user
    if (user) {
      const daysSinceCreated = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      const counts = user._count
      onboardingItems = [
        { label: 'Verifikasi email', done: user.emailVerified, href: '#' },
        { label: 'Buat produk pertama', done: counts.products > 0, href: '/products' },
        { label: 'Hubungkan akun Meta', done: counts.metaAccounts > 0, href: '/meta-connections' },
        { label: 'Buat campaign pertama', done: counts.campaignSessions > 0, href: '/test-launches/new' },
        { label: 'Generate video pertama', done: counts.generatedMedia > 0, href: '/media' },
        { label: 'Jalankan test pertama', done: counts.adTests > 0, href: '/ads?tab=testing' },
      ]
      // Only show checklist for new-ish users or incomplete ones
      if (daysSinceCreated > 30 && onboardingItems.every(i => i.done)) {
        onboardingItems = null
      }
    }

    // Spend & ROAS hari ini: snapshot terbaru per campaign
    const seen = new Set<string>()
    let spend = 0
    let weightedRoas = 0
    for (const s of todaySnapshots) {
      if (seen.has(s.metaEntityId)) continue
      seen.add(s.metaEntityId)
      spend += s.spend
      if (s.roas) weightedRoas += s.roas * s.spend
    }
    const roas = spend > 0 && weightedRoas > 0 ? weightedRoas / spend : null

    const workerHealthy = false
    const workerKnown = false

    return {
      hasMetrics: todaySnapshots.length > 0,
      spend,
      roas,
      runningCampaigns,
      pendingApprovals,
      pendingActions,
      monitors,
      runningTests,
      winnerTests,
      workerHealthy,
      workerKnown,
      onboardingItems,
    }
  } catch (e) {
    console.error('[dashboard]', e)
    return {
      hasMetrics: false, spend: 0, roas: null, runningCampaigns: 0,
      pendingApprovals: [], pendingActions: [], monitors: [],
      runningTests: [], winnerTests: [],
      workerHealthy: false, workerKnown: false,
      onboardingItems: null,
    }
  }
}

const ACTION_LABELS: Record<string, string> = {
  PAUSE_CAMPAIGN: 'Pause campaign',
  RESUME_CAMPAIGN: 'Resume campaign',
  PAUSE_ADSET: 'Pause ad set',
  RESUME_ADSET: 'Resume ad set',
  UPDATE_BUDGET: 'Ubah budget',
  CREATE_CAMPAIGN: 'Buat campaign',
  CREATE_AD: 'Buat ad',
  REPLACE_AD: 'Ganti ad',
  ADD_CREATIVE: 'Tambah creative',
  NOTIFY: 'Notifikasi',
}

function timeAgo(d: Date): string {
  const m = Math.round((Date.now() - d.getTime()) / 60_000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} mnt lalu`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} jam lalu`
  return `${Math.round(h / 24)} hari lalu`
}

export default async function DashboardPage() {
  const d = await getDashboardData()
  const decisions = d.pendingApprovals.length + d.pendingActions.length

  const posted = d.monitors.filter(m => ['STILL_GROWING', 'HOT_VIDEO', 'MONITORING'].includes(m.status))
  const ready = d.monitors.filter(m => m.status === 'READY_UPLOAD')

  return (
    <div className="space-y-5">
      {/* Onboarding checklist — show only for new/incomplete users */}
      {d.onboardingItems && d.onboardingItems.some(i => !i.done) && (
        <div className="bg-white border border-violet-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🚀</span>
            <div>
              <h3 className="text-sm font-bold text-stone-800">Mulai menggunakan AI Buddy</h3>
              <p className="text-[11px] text-stone-400">Selesaikan langkah-langkah berikut untuk memulai.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {d.onboardingItems.map((item, i) => (
              <a
                key={i}
                href={item.href}
                className={`flex items-center gap-2.5 p-3 rounded-lg border text-xs transition-colors ${
                  item.done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-violet-300 hover:bg-violet-50'
                }`}
              >
                <span className={`text-base ${item.done ? '' : 'text-stone-300'}`}>
                  {item.done ? '✅' : '⬜'}
                </span>
                <span className="font-medium truncate">{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Header strip — 4 angka */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Spend hari ini</p>
          <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-stone-900">
            {d.hasMetrics ? fmtIdr(d.spend) : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-400">
            {d.hasMetrics ? 'snapshot terbaru per campaign' : 'data metrics menyusul'}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">ROAS blended</p>
          <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-stone-900">
            {d.roas ? `${d.roas.toFixed(1)}×` : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-400">
            {d.roas ? 'weighted by spend' : 'belum ada data hari ini'}
          </p>
        </div>
        <Link href="/ads?tab=monitor" className="card p-5 hover:border-stone-300 transition-colors">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Campaign aktif</p>
          <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-stone-900">{d.runningCampaigns}</p>
          <p className="mt-0.5 text-[11px] text-stone-400">status RUNNING</p>
        </Link>
        <Link
          href={d.pendingApprovals.length > 0 ? '/approval-requests' : '/ads?tab=actions'}
          className={`rounded-xl border p-5 transition-colors ${
            decisions > 0
              ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
              : 'card hover:border-stone-300'
          }`}
        >
          <p className={`text-[10px] font-bold uppercase tracking-wider ${decisions > 0 ? 'text-amber-700' : 'text-stone-400'}`}>
            Butuh keputusan
          </p>
          <p className={`mt-1.5 text-2xl font-extrabold tracking-tight ${decisions > 0 ? 'text-amber-800' : 'text-stone-900'}`}>
            {decisions}
          </p>
          <p className={`mt-0.5 text-[11px] ${decisions > 0 ? 'text-amber-600' : 'text-stone-400'}`}>
            {d.pendingApprovals.length} approval · {d.pendingActions.length} action
          </p>
        </Link>
      </div>

      {/* Dua kolom: antrian keputusan + influencer */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Antrian keputusan */}
        <div className="card p-5 lg:col-span-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-3.5">
            ⚡ Butuh keputusan lo
          </p>
          {decisions === 0 ? (
            <div className="text-center py-8">
              <p className="text-xl mb-1">✓</p>
              <p className="text-sm text-stone-500 font-medium">Semua beres — nggak ada yang nunggu.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {d.pendingApprovals.map(a => (
                <Link
                  key={a.id}
                  href="/approval-requests"
                  className="flex items-center gap-3 p-3 rounded-lg border border-violet-100 bg-violet-50/60 hover:bg-violet-50 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-800 truncate">
                      Approval launch — {a.testLaunch?.name ?? 'launch'}
                    </p>
                    <p className="text-[11px] text-stone-400">{timeAgo(a.createdAt)}</p>
                  </div>
                  <span className="text-xs font-bold text-violet-600 shrink-0">Review →</span>
                </Link>
              ))}
              {d.pendingActions.map(a => (
                <Link
                  key={a.id}
                  href="/ads?tab=actions"
                  className="flex items-center gap-3 p-3 rounded-lg border border-amber-100 bg-amber-50/60 hover:bg-amber-50 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-800 truncate">
                      {ACTION_LABELS[a.actionType] ?? a.actionType}
                    </p>
                    <p className="text-[11px] text-stone-400 truncate">{a.source === 'RULE' ? 'dari rule otomatis' : a.source === 'SCHEDULE' ? 'terjadwal' : 'manual'} · {timeAgo(a.createdAt)}</p>
                  </div>
                  <span className="text-xs font-bold text-amber-600 shrink-0">Putuskan →</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tes Berjalan */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-baseline justify-between mb-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">🧪 Tes Berjalan</p>
            <Link href="/ads?tab=testing" className="text-[11px] font-semibold text-violet-600 hover:underline">
              semua →
            </Link>
          </div>
          {d.runningTests.length === 0 ? (
            <p className="text-sm text-stone-400 py-6 text-center">Belum ada tes berjalan.</p>
          ) : (
            <div className="space-y-1.5">
              {d.runningTests.map(t => {
                const leader = pickTestLeader(t.variants, t.successMetric)
                const leaderVal = leader ? testMetricValue(leader, t.successMetric) : null
                return (
                  <Link
                    key={t.id}
                    href="/ads?tab=testing"
                    className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-stone-50 transition-colors"
                  >
                    <span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center text-[10px] font-bold text-violet-700 shrink-0">
                      {t.type.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-stone-800 truncate">{t.name}</p>
                      <p className="text-[10px] text-stone-500">{t.type} · {t.variants.length} varian</p>
                    </div>
                    {leader && (
                      <span className="text-[11px] font-semibold text-emerald-600 shrink-0">
                        {leader.label}: {fmtTestMetric(leaderVal, t.successMetric)}
                        <span className="ml-1 text-[9px] font-medium text-stone-400">{t.successMetric}</span>
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Winner Terbaru */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-baseline justify-between mb-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">🏆 Winner Terbaru</p>
            <Link href="/ads?tab=testing" className="text-[11px] font-semibold text-violet-600 hover:underline">
              semua →
            </Link>
          </div>
          {d.winnerTests.length === 0 ? (
            <p className="text-sm text-stone-400 py-6 text-center">Belum ada winner.</p>
          ) : (
            <div className="space-y-1.5">
              {d.winnerTests.map(t => {
                const w = t.variants.find(v => v.id === t.winnerVariantId)
                return (
                  <Link
                    key={t.id}
                    href="/ads?tab=testing"
                    className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-stone-50 transition-colors"
                  >
                    <span className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700 shrink-0">
                      {t.type.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-stone-800 truncate">{t.name}</p>
                      <p className="text-[10px] text-stone-500">{t.type} · {w ? `Pemenang: ${w.label} (${fmtTestMetric(testMetricValue(w, t.successMetric), t.successMetric)})` : ''}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer sinyal sistem — zero-worker (all direct/SaaS) */}
      <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl px-4 py-2.5">
        <span className="text-[11px] text-stone-400 font-medium">Sinyal sistem:</span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          zero-worker — semua operasi langsung/SaaS
        </span>
      </div>
    </div>
  )
}
