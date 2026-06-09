import StatusBadge from '@/components/ui/StatusBadge'
import Table from '@/components/ui/Table'
import PageInfo from '@/components/ui/PageInfo'

interface Topic {
  id: string
  name: string
  description: string
  status: string
  createdAt: string
  character: { id: string; name: string } | null
  product: { id: string; name: string } | null
  _count?: { ceps: number }
}

async function getTopics(): Promise<Topic[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${base}/api/admin/topics`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function TopicsPage() {
  const topics = await getTopics()

  const activeCount = topics.filter((t) => t.status === 'active').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Topics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {topics.length} total · {activeCount} active
          </p>
        </div>
        <button
          title="Topik dibuat saat setup character atau product — belum tersedia di halaman ini"
          disabled
          className="cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-400"
        >
          + Add Topic
        </button>
      </div>

      <PageInfo
        purpose="Topik bahasan yang menjadi fokus konten. CEP diorganisir per topik. Satu character bisa punya banyak topik."
        inputs={[
          'Nama topik (misal: Kulit diabetes kering menghitam)',
          'Deskripsi detail topik',
          'Relasi ke Character (opsional)',
          'Relasi ke Product (opsional)',
        ]}
        wiring={[
          { label: '← Character', desc: 'topik terikat ke character tertentu' },
          { label: '← Product', desc: 'topik bisa terkait produk CPAS' },
          { label: '→ CEP', desc: 'tiap topik punya banyak CEP' },
          { label: '→ Hermes API', desc: 'topik + CEP-nya dikirim dalam library response' },
        ]}
      />

      <Table
        headers={['Name', 'Character', 'Product', 'Status', 'Description', 'CEPs', 'Created']}
        empty="No topics found."
      >
        {topics.map((topic) => (
          <tr key={topic.id} className="hover:bg-gray-50 transition-colors">
            <td className="px-4 py-3">
              <p className="font-medium text-gray-900">{topic.name}</p>
            </td>
            <td className="px-4 py-3 text-gray-600">
              {topic.character?.name ?? <span className="text-gray-300">—</span>}
            </td>
            <td className="px-4 py-3 text-gray-600">
              {topic.product?.name ?? <span className="text-gray-300">—</span>}
            </td>
            <td className="px-4 py-3">
              <StatusBadge status={topic.status} />
            </td>
            <td className="px-4 py-3 text-gray-500 max-w-[260px]">
              <p className="truncate">{topic.description}</p>
            </td>
            <td className="px-4 py-3 text-gray-600 font-medium">
              {topic._count?.ceps ?? 0}
            </td>
            <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
              {new Date(topic.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  )
}
