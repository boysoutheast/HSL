import { fetchAllFeeds, fillMissingImages } from './lib/rss'
import { processNewsWithAI } from './lib/ai-editor'
import NewsLayout from './NewsLayout'

export const revalidate = 3600 // ISR — rebuild tiap 1 jam

export default async function NewsPage() {
  // 1. Fetch RSS dari 5 portal
  const articles = await fetchAllFeeds()

  // 2. Isi gambar yang kosong via og:image scrape
  const articlesWithImages = await fillMissingImages(articles)

  // 3. Proses dengan DeepSeek (cached per jam via unstable_cache)
  const { mainStory, relatedStories, fillerArticles } =
    await processNewsWithAI(articlesWithImages)

  return (
    <NewsLayout
      mainStory={mainStory}
      relatedStories={relatedStories}
      fillerArticles={fillerArticles}
      allArticles={articlesWithImages}
    />
  )
}
