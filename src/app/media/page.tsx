import Link from 'next/link'
import TabLayout from '@/components/TabLayout'

const tabs = [
  { id: 'library', label: 'Library', href: '/media?tab=library' },
  { id: 'products', label: 'Products', href: '/media?tab=products' },
  { id: 'generate', label: 'Generate', href: '/media?tab=generate' },
]

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const key = tab || 'library'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Media</h1>
        <p className="text-sm text-stone-500 mt-1">Library, products, dan generate task.</p>
      </div>
      <TabLayout tabs={tabs}>
        {key === 'library' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
            <Link href="/media-library" className="inline-flex px-4 py-2 text-sm font-medium bg-stone-50 border border-stone-200 rounded-lg hover:bg-white hover:border-violet-200">Buka Media Library</Link>
          </div>
        )}
        {key === 'products' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
            <Link href="/products" className="inline-flex px-4 py-2 text-sm font-medium bg-stone-50 border border-stone-200 rounded-lg hover:bg-white hover:border-violet-200">Buka Products</Link>
          </div>
        )}
        {key === 'generate' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
            <p className="text-sm text-stone-400">Generate v1 — coming soon.</p>
          </div>
        )}
      </TabLayout>
    </div>
  )
}
