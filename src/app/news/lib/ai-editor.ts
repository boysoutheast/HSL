// AI Editor — DeepSeek rewrite + unstable_cache
// Wajib: jangan panggil DeepSeek tiap page load — cache per jam.

import { unstable_cache } from 'next/cache'
import { llmJson } from '@/lib/llm'
import type { RawArticle, RewrittenStory, NewsAIResponse } from './types'

const SYSTEM_PROMPT = `Kamu adalah editor berita Indonesia kelas dunia. Tulis ulang dengan gaya CNN Indonesia — tajam, mengalir, retensi tinggi. JANGAN salin verbatim. Sertakan semua fakta kunci.

Headline: kuat, curiosity gap, max 12 kata. Hindari clickbait murahan. Angka spesifik > abstrak ("3 Provinsi" bukan "Beberapa Provinsi").
Body: 4-6 paragraf. Paragraf pertama = hook kuat (fakta mengejutkan atau angka konkret).
Subheadline: kasih konteks "kenapa ini penting buat pembaca".
readTimeMinutes: estimasi waktu baca.
category: pilih salah satu — Nasional | Ekonomi | Teknologi | Dunia | Olahraga | Hiburan`

function buildUserPrompt(articles: RawArticle[]): string {
  const list = articles
    .map((a, i) => `[${i}] ${a.source}: "${a.title}"\n    ${a.excerpt.slice(0, 200)}`)
    .join('\n\n')

  return `Berikut ${articles.length} artikel dari portal Indonesia hari ini.

${list}

TUGAS:
1. Identifikasi 3 artikel yang punya benang merah terkuat (isu yang sama, dampak besar, relevan publik luas).
2. Tulis ulang jadi 1 artikel utama (mainStory) gabungan dari ketiganya.
3. Dari 2 sisanya, buat 2 artikel pendukung singkat (relatedStories).
4. Headline: kuat, curiosity gap, max 12 kata. Hindari clickbait murahan.
5. Body: 4-6 paragraf. Paragraf pertama = hook kuat (fakta mengejutkan atau angka konkret).

Output JSON:
{
  "mainStory": { "headline", "subheadline", "body", "sources": [{"name","url"}], "imageUrl", "category", "readTimeMinutes" },
  "relatedStories": [ ...same shape x2 ],
  "fillerIndices": [array index artikel yang tidak dipakai untuk main/related]
}`
}

/** Fallback: pakai 3 artikel pertama as-is tanpa rewrite. */
function buildFallbackTop3(articles: RawArticle[]): NewsAIResponse {
  const top3 = articles.slice(0, 3)
  const toRewritten = (a: RawArticle): RewrittenStory => ({
    headline: a.title,
    subheadline: a.excerpt.slice(0, 120),
    body: a.excerpt || `Baca selengkapnya di ${a.source}.`,
    sources: [{ name: a.source, url: a.url }],
    imageUrl: a.imageUrl ?? '',
    category: 'Nasional',
    readTimeMinutes: Math.max(1, Math.ceil((a.excerpt.length || 200) / 500)),
  })

  return {
    mainStory: toRewritten(top3[0]),
    relatedStories: [toRewritten(top3[1]), toRewritten(top3[2])],
    fillerIndices: articles.slice(3).map((_, i) => i + 3),
  }
}

/** Coba panggil DeepSeek — retry 1x kalau JSON parse error. */
async function callDeepSeek(articles: RawArticle[]): Promise<NewsAIResponse> {
  try {
    const result = await llmJson<NewsAIResponse>(SYSTEM_PROMPT, buildUserPrompt(articles))
    return result
  } catch {
    // Retry 1x
    try {
      return await llmJson<NewsAIResponse>(SYSTEM_PROMPT, buildUserPrompt(articles))
    } catch {
      throw new Error('DeepSeek gagal setelah 2 percobaan')
    }
  }
}

/** Core function: process articles with AI, cached per jam. */
export async function processNewsWithAI(articles: RawArticle[]): Promise<{
  mainStory: RewrittenStory
  relatedStories: RewrittenStory[]
  fillerArticles: RawArticle[]
}> {
  // Cached version — key per jam UTC
  const cacheKey = `news-${new Date().toISOString().slice(0, 13)}`

  const getCached = unstable_cache(
    async () => {
      if (articles.length === 0) {
        // Fallback: feed semua kosong
        return {
          mainStory: {
            headline: 'Belum Ada Berita',
            subheadline: 'Feed berita sedang tidak tersedia. Coba lagi nanti.',
            body: 'Maaf, kami tidak dapat memuat berita saat ini. Silakan refresh halaman dalam beberapa menit.',
            sources: [],
            imageUrl: '',
            category: 'Nasional',
            readTimeMinutes: 1,
          } as RewrittenStory,
          relatedStories: [] as RewrittenStory[],
          fillerIndices: [] as number[],
        } as NewsAIResponse
      }

      let response: NewsAIResponse
      try {
        response = await callDeepSeek(articles)
      } catch {
        // Fallback: 3 artikel pertama as-is
        response = buildFallbackTop3(articles)
      }

      return response
    },
    [cacheKey],
    { revalidate: 3600 }
  )

  const result = await getCached()

  const fillerArticles = articles.filter((_, i) => result.fillerIndices.includes(i))

  return {
    mainStory: result.mainStory,
    relatedStories: result.relatedStories,
    fillerArticles,
  }
}
