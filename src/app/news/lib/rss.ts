// RSS fetcher & parser — 5 portal Indonesia
// No external XML lib — regex-based untuk RSS yang predictable.

import { RawArticle } from './types'

const FEEDS: { source: string; url: string }[] = [
  { source: 'Kompas', url: 'https://rss.kompas.com/' },
  { source: 'Detik', url: 'https://www.detik.com/rss' },
  { source: 'CNN Indonesia', url: 'https://www.cnnindonesia.com/rss' },
  { source: 'Liputan6', url: 'https://www.liputan6.com/rss' },
  { source: 'Tribun', url: 'https://www.tribunnews.com/rss' },
]

function extractTag(text: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = text.match(regex)
  if (!m) return null
  let content = m[1].trim()
  // Strip CDATA wrapping
  content = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
  return content
}

function extractAllTags(text: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  const results: string[] = []
  let match
  while ((match = regex.exec(text)) !== null) {
    results.push(match[1].trim())
  }
  return results
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function extractEnclosureImage(itemXml: string): string | null {
  // <enclosure url="..." type="image/...">
  const encMatch = itemXml.match(/<enclosure[^>]*url="([^"]+)"[^>]*>/i)
  if (encMatch) return encMatch[1]

  // <media:content url="..." .../> or <media:content ... url="...">
  const mediaMatch = itemXml.match(/<media:content[^>]*url="([^"]+)"[^>]*>/i)
  if (mediaMatch) return mediaMatch[1]

  return null
}

function parseRssItems(xml: string, source: string): RawArticle[] {
  const items: RawArticle[] = []

  // Cari semua <item>...</item>
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let itemMatch
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemXml = itemMatch[1]

    const title = extractTag(itemXml, 'title')
    const link = extractTag(itemXml, 'link')
    const descriptionRaw = extractTag(itemXml, 'description')
    const pubDate = extractTag(itemXml, 'pubDate')
    const excerpt = descriptionRaw ? stripHtml(descriptionRaw).slice(0, 300) : ''
    const imageUrl = extractEnclosureImage(itemXml)

    if (!title || !link) continue

    items.push({
      title,
      url: link,
      source,
      publishedAt: pubDate ?? new Date().toISOString(),
      excerpt,
      imageUrl,
    })
  }

  return items
}

async function fetchFeed(feed: { source: string; url: string }): Promise<RawArticle[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Hermes-News/1.0' },
    })

    if (!res.ok) {
      console.warn(`[news/rss] ${feed.source} responded ${res.status}`)
      return []
    }

    const xml = await res.text()
    const items = parseRssItems(xml, feed.source)
    return items.slice(0, 10)
  } catch (err) {
    console.warn(`[news/rss] ${feed.source} gagal:`, (err as Error).message)
    return []
  } finally {
    clearTimeout(timeout)
  }
}

/** Fetch semua feed — tiap feed independen, gagal satu skip. */
export async function fetchAllFeeds(): Promise<RawArticle[]> {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed))

  const all: RawArticle[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') {
      all.push(...r.value)
    }
  }

  // Urut dari terbaru
  all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  return all
}

/** Ambil og:image dari URL artikel — fallback kalau RSS tidak kasih gambar. */
export async function fetchOgImage(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    const html = await res.text()
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    return m?.[1] ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/** Coba isi gambar yang null dengan og:image scrape. Batch terbatas. */
export async function fillMissingImages(articles: RawArticle[]): Promise<RawArticle[]> {
  const needsImage = articles.filter((a) => !a.imageUrl).slice(0, 15) // max 15 scrape per batch
  const results = await Promise.allSettled(
    needsImage.map((a) => fetchOgImage(a.url).then((img) => ({ url: a.url, img })))
  )

  const imageMap = new Map<string, string | null>()
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.img) {
      imageMap.set(r.value.url, r.value.img)
    }
  }

  return articles.map((a) => {
    if (!a.imageUrl && imageMap.has(a.url)) {
      return { ...a, imageUrl: imageMap.get(a.url)! }
    }
    return a
  })
}
