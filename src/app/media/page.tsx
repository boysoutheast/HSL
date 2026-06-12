import ClientTabs from '@/components/ClientTabs'
import MediaLibraryPage from '../media-library/page'
import ProductsPage from '../products/page'

const tabs = [
  { id: 'library', label: 'Library' },
  { id: 'products', label: 'Products' },
  { id: 'generate', label: 'Generate' },
]

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const key = tab && tabs.some(t => t.id === tab) ? tab : 'library'

  return (
    <ClientTabs
      tabs={tabs}
      initial={key}
      basePath="/media"
      panels={{
        library: <MediaLibraryPage />,
        products: <ProductsPage />,
        generate: (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
            <p className="text-2xl mb-2">✨</p>
            <p className="text-sm font-semibold text-stone-700 mb-1">Generate dari Produk</p>
            <p className="text-sm text-stone-400">
              Antrian GENERATE_PHOTO / GENERATE_VIDEO via Hermes worker — menunggu handler worker tersedia.
            </p>
          </div>
        ),
      }}
    />
  )
}
