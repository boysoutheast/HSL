import PageInfo from '@/components/ui/PageInfo'

async function getDashboardData() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  try {
    const [monitorRes, cepsRes, agentsRes, accountsRes] = await Promise.all([
      fetch(`${base}/api/admin/posting-monitor`, { cache: 'no-store' }),
      fetch(`${base}/api/admin/ceps`, { cache: 'no-store' }),
      fetch(`${base}/api/admin/hermes-agents`, { cache: 'no-store' }),
      fetch(`${base}/api/admin/accounts`, { cache: 'no-store' }),
    ])

    const monitors: { status: string }[] = monitorRes.ok ? await monitorRes.json() : []
    const ceps: { status: string }[] = cepsRes.ok ? await cepsRes.json() : []
    const agents: { status: string }[] = agentsRes.ok ? await agentsRes.json() : []
    const accounts: { status: string }[] = accountsRes.ok ? await accountsRes.json() : []

    return {
      totalActiveAccounts: accounts.filter((a) => a.status === 'active').length,
      readyUpload: monitors.filter((m) => m.status === 'READY_UPLOAD').length,
      hotVideo: monitors.filter((m) => m.status === 'HOT_VIDEO').length,
      stillGrowing: monitors.filter((m) => m.status === 'STILL_GROWING').length,
      pendingCep: ceps.filter((c) => c.status === 'pending_review').length,
      activeAgents: agents.filter((a) => a.status === 'active').length,
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
  color: string
  href: string
  description: string
}

function StatCard({ label, value, color, href, description }: StatCardProps) {
  return (
    <a
      href={href}
      className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
    >
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 ${color}`}>
        <span className="text-sm font-bold text-white">{value}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-0.5">{value}</p>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
    </a>
  )
}

export default async function DashboardPage() {
  const data = await getDashboardData()
  const now = new Date()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Last updated: {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <PageInfo
        purpose="Ringkasan seluruh sistem. Lihat status akun, antrian Hermes, dan CEP yang menunggu review."
        wiring={[
          { label: '→ Monitor', desc: 'klik status untuk lihat detail' },
          { label: '→ CEP', desc: 'pending review dari Hermes AI' },
        ]}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard
          label="Active Accounts"
          value={data.totalActiveAccounts}
          color="bg-indigo-500"
          href="/accounts"
          description="Instagram accounts"
        />
        <StatCard
          label="Ready Upload"
          value={data.readyUpload}
          color="bg-emerald-500"
          href="/monitor"
          description="Waiting to post"
        />
        <StatCard
          label="Hot Videos"
          value={data.hotVideo}
          color="bg-orange-500"
          href="/monitor?status=HOT_VIDEO"
          description="Currently viral"
        />
        <StatCard
          label="Still Growing"
          value={data.stillGrowing}
          color="bg-cyan-500"
          href="/monitor?status=STILL_GROWING"
          description="Gaining traction"
        />
        <StatCard
          label="Pending CEP"
          value={data.pendingCep}
          color="bg-yellow-500"
          href="/ceps?tab=pending"
          description="Awaiting approval"
        />
        <StatCard
          label="Active Agents"
          value={data.activeAgents}
          color="bg-violet-500"
          href="/agents"
          description="Hermes AI agents"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Quick Actions</h2>
          <div className="space-y-2">
            <a
              href="/monitor"
              className="flex items-center justify-between p-3 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
            >
              <span className="text-sm font-medium text-emerald-800">Review Ready Upload Queue</span>
              <span className="text-xs bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                {data.readyUpload}
              </span>
            </a>
            <a
              href="/ceps?tab=pending_review"
              className="flex items-center justify-between p-3 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors"
            >
              <span className="text-sm font-medium text-yellow-800">Review Pending CEPs</span>
              <span className="text-xs bg-yellow-200 text-yellow-900 px-2 py-0.5 rounded-full">
                {data.pendingCep}
              </span>
            </a>
            <a
              href="/agents"
              className="flex items-center justify-between p-3 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
            >
              <span className="text-sm font-medium text-violet-800">Manage Hermes Agents</span>
              <span className="text-xs bg-violet-200 text-violet-900 px-2 py-0.5 rounded-full">
                {data.activeAgents} active
              </span>
            </a>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Posting Monitor Breakdown</h2>
          <div className="space-y-3">
            {[
              { label: 'Ready Upload', value: data.readyUpload, className: 'bg-emerald-500' },
              { label: 'Still Growing', value: data.stillGrowing, className: 'bg-cyan-500' },
              { label: 'Hot Video', value: data.hotVideo, className: 'bg-orange-500' },
            ].map(({ label, value, className }) => {
              const total = data.readyUpload + data.stillGrowing + data.hotVideo || 1
              const pct = Math.round((value / total) * 100)
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${className} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
