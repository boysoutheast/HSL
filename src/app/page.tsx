import PageInfo from '@/components/ui/PageInfo'
import { prisma } from '@/lib/prisma'

async function getDashboardData() {
  try {
    const [
      activeAccounts,
      monitors,
      pendingCep,
      activeAgents,
    ] = await Promise.all([
      prisma.instagramAccount.count({ where: { status: 'active' } }),
      prisma.postingMonitor.findMany({ select: { status: true } }),
      prisma.cep.count({ where: { status: 'pending_review' } }),
      prisma.hermesAgent.count({ where: { status: 'active' } }),
    ])

    return {
      totalActiveAccounts: activeAccounts,
      readyUpload: monitors.filter((m) => m.status === 'READY_UPLOAD').length,
      hotVideo: monitors.filter((m) => m.status === 'HOT_VIDEO').length,
      stillGrowing: monitors.filter((m) => m.status === 'STILL_GROWING').length,
      pendingCep,
      activeAgents,
    }
  } catch {
    return {
      totalActiveAccounts: 0,
      readyUpload: 0,
      hotVideo: 0,
      stillGrowing: 0,
      pendingCep: 0,
      activeAgents: 0,
    }
  }
}

interface StatCardProps {
  label: string
  value: number
  tone: string
  href: string
  description: string
}

function StatCard({ label, value, tone, href, description }: StatCardProps) {
  return (
    <a href={href} className="card-hover block p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-stone-900">{value}</p>
          <p className="mt-1 text-sm text-stone-500">{description}</p>
        </div>
        <div className={`h-11 w-11 rounded-2xl ${tone} text-white flex items-center justify-center text-sm font-semibold shadow-sm`}>
          {value}
        </div>
      </div>
    </a>
  )
}

export default async function DashboardPage() {
  const data = await getDashboardData()
  const now = new Date()

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-500">Hermes Support Library</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
              Ringkasan sistem harian. Fokus lihat akun aktif, queue Hermes, posting monitor, dan CEP yang butuh review.
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Updated</p>
            <p className="mt-1 font-medium text-stone-700">
              {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </section>

      <PageInfo
        purpose="Dashboard ini untuk baca status cepat, bukan untuk edit data. Klik kartu di bawah untuk masuk ke modul kerja."
        wiring={[
          { label: 'Monitor', desc: 'status upload dan video performance' },
          { label: 'CEP', desc: 'antrian review dari Hermes Agent' },
        ]}
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Active Accounts"
          value={data.totalActiveAccounts}
          tone="bg-violet-600"
          href="/accounts"
          description="Instagram accounts yang aktif dipakai"
        />
        <StatCard
          label="Ready Upload"
          value={data.readyUpload}
          tone="bg-emerald-600"
          href="/monitor"
          description="Konten siap upload sekarang"
        />
        <StatCard
          label="Hot Videos"
          value={data.hotVideo}
          tone="bg-amber-500"
          href="/monitor?status=HOT_VIDEO"
          description="Video yang sedang panas"
        />
        <StatCard
          label="Still Growing"
          value={data.stillGrowing}
          tone="bg-cyan-600"
          href="/monitor?status=STILL_GROWING"
          description="Video masih tumbuh stabil"
        />
        <StatCard
          label="Pending CEP"
          value={data.pendingCep}
          tone="bg-rose-500"
          href="/ceps?tab=pending"
          description="CEP menunggu approval"
        />
        <StatCard
          label="Active Agents"
          value={data.activeAgents}
          tone="bg-stone-700"
          href="/agents"
          description="Hermes agent yang sedang aktif"
        />
      </section>
    </div>
  )
}
