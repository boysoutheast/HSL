import ClientTabs from '@/components/ClientTabs'
import MediaLibraryPage from '../media-library/page'
import ProductsPage from '../products/page'
import GenerateVideoPage from './GenerateVideoPage'

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
        generate: <GenerateVideoPage />,
      }}
    />
  )
}
