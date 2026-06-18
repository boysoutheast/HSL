# Blueprint: News Portal — /news

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION
**Route:** `/news` di dalam HSL app (ai.boytenggara.com/news)
**Target:** Layout seperti CNN/NYT, konten dari 5 portal Indonesia terbesar, ditulis ulang DeepSeek

---

## Konsep

1. Ambil RSS dari 5 portal Indonesia terbesar
2. DeepSeek cari 3 artikel dengan benang merah yang sama → rewrite jadi 1 artikel utama + 2 pendukung
3. Sisa RSS jadi filler grid
4. Layout CNN-style: hero besar, grid 3 kolom, sidebar trending
5. Cache ISR 1 jam (bukan per-request — DeepSeek JANGAN dipanggil tiap page load)
6. Gambar: og:image dari artikel asli (hotlink sementara)

---

## Sumber RSS (5 portal)

```
Kompas    : https://rss.kompas.com/
Detik     : https://www.detik.com/rss
CNN ID    : https://www.cnnindonesia.com/rss
Liputan6  : https://www.liputan6.com/rss
Tribun    : https://www.tribunnews.com/rss
```

---

## File Structure

```
src/app/news/
  page.tsx          ← Server component, ISR revalidate:3600
  NewsLayout.tsx    ← Client component untuk layout
  lib/
    rss.ts          ← fetch + parse RSS
    ai-editor.ts    ← DeepSeek: find thread + rewrite
    types.ts        ← interface Article, RewrittenStory
```

---

## Types (`types.ts`)

```ts
export interface RawArticle {
  title: string
  url: string
  source: string          // 'Kompas' | 'Detik' | dll
  publishedAt: string
  excerpt: string
  imageUrl: string | null
}

export interface RewrittenStory {
  headline: string        // kuat, curiosity gap, max 12 kata
  subheadline: string     // 1 kalimat konteks
  body: string            // 4-6 paragraf, rewritten, NOT verbatim copy
  sources: { name: string; url: string }[]
  imageUrl: string        // og:image dari artikel terkuat
  category: string        // Nasional | Ekonomi | Teknologi | Dunia
  readTimeMinutes: number
}
```

---

## RSS Fetching (`rss.ts`)

```ts
// Fetch + parse XML RSS. Ambil 10 artikel terbaru per feed.
// Ekstrak: title, link, description (strip HTML), pubDate, enclosure/media:content untuk image
// Kalau gambar tidak ada di RSS → fetch URL artikel → scrape og:image
// Timeout 5 detik per feed, gagal → skip (jangan crash halaman)
// Return: RawArticle[]

export async function fetchAllFeeds(): Promise<RawArticle[]>
```

Parser: gunakan native DOMParser (Next.js edge) atau regex sederhana — jangan install xml2js (tambah bundle size).

---

## AI Editor (`ai-editor.ts`)

```ts
// Input: RawArticle[] (semua artikel dari semua feed)
// Output: { mainStory: RewrittenStory, relatedStories: RewrittenStory[], fillerArticles: RawArticle[] }

export async function processNewsWithAI(articles: RawArticle[])
```

**Prompt DeepSeek (via src/lib/llm.ts — WAJIB, jangan pakai provider lain):**

```
System: Kamu adalah editor berita Indonesia kelas dunia. Tulis ulang dengan gaya CNN Indonesia — tajam, mengalir, retensi tinggi. JANGAN salin verbatim. Sertakan semua fakta kunci.

User:
Berikut ${articles.length} artikel dari portal Indonesia hari ini.

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
}
```

Guard:
- Kalau DeepSeek gagal/timeout → fallback: pakai 3 artikel pertama as-is (raw, tanpa rewrite)
- JSON parse error → retry 1x
- Cache result di Next.js cache (unstable_cache dengan key = date + hour)

---

## Page (`page.tsx`)

```ts
export const revalidate = 3600  // ISR — rebuild tiap 1 jam

export default async function NewsPage() {
  const articles = await fetchAllFeeds()
  const { mainStory, relatedStories, fillerArticles } = await processNewsWithAI(articles)
  return <NewsLayout main={mainStory} related={relatedStories} filler={fillerArticles} />
}
```

**PENTING:** `processNewsWithAI` harus di-wrap `unstable_cache` dari `next/cache` dengan key `['news', new Date().toISOString().slice(0,13)]` (per jam). Ini cegah DeepSeek dipanggil setiap request.

---

## Layout CNN-style (`NewsLayout.tsx`)

```
┌─────────────────────────────────────────────────────┐
│  HEADER: Logo "Hermes News" · Nav: Nasional Ekonomi Teknologi Dunia │
├─────────────────────────────────────────────────────┤
│  HERO (full width):                                  │
│  [Image besar 16:9]  Headline XL                    │
│                      Subheadline                    │
│                      Category badge · Read time · Sources │
├───────────────────────┬─────────────────────────────┤
│  RELATED (2 kolom)    │  TRENDING SIDEBAR            │
│  [img] Headline       │  1. Judul artikel            │
│  [img] Headline       │  2. Judul artikel            │
│                       │  3. Judul artikel            │
├───────────────────────┴─────────────────────────────┤
│  FILLER GRID (3 kolom)                               │
│  [img] Judul · Source · Waktu                        │
│  [img] Judul · Source · Waktu                        │
│  [img] Judul · Source · Waktu                        │
└─────────────────────────────────────────────────────┘
```

**Design rules:**
- Font: system-ui (bawaan, tidak perlu Google Fonts)
- Warna: stone-900 (text), stone-100 (bg), red-600 (accent/breaking), violet-600 (category)
- Hero image: object-cover aspect-[16/9], max-h-[480px]
- Filler grid image: aspect-[4/3], rounded-lg
- Hover state: headline underline, image scale-105
- Mobile: hero full width → related stack → filler 1 kolom
- Timestamp: "X jam lalu" (hitung dari pubDate)
- Sources section: "Sumber: Kompas, Detik" — linked, font-size xs

**High-retention hooks wajib:**
- Headline: angka spesifik > abstrak ("3 Provinsi" bukan "Beberapa Provinsi")
- Lead paragraph: fakta paling mengejutkan DULU
- Subheadline: kasih konteks "kenapa ini penting buat lo"

---

## Middleware — route publik

Tambah `/news` ke `PUBLIC_PATHS` di `src/middleware.ts` — halaman ini tidak perlu login.

---

## Acceptance Criteria

- [ ] `https://ai.boytenggara.com/news` bisa diakses tanpa login
- [ ] Hero tampil dengan gambar + headline rewritten oleh DeepSeek
- [ ] Sources ditampilkan + bisa di-klik ke artikel asli
- [ ] Filler grid tampil minimal 6 artikel
- [ ] ISR jalan — reload page kedua < 200ms (cache hit)
- [ ] Mobile responsive
- [ ] `tsc --noEmit` 0 error
- [ ] DeepSeek tidak dipanggil tiap page load (verify via log)

---

## Execution Order

```
1. src/app/news/lib/types.ts
2. src/app/news/lib/rss.ts (fetch + parse, no dependency)
3. src/app/news/lib/ai-editor.ts (DeepSeek + unstable_cache)
4. src/app/news/NewsLayout.tsx (layout client component)
5. src/app/news/page.tsx (server component, revalidate:3600)
6. src/middleware.ts → tambah /news ke PUBLIC_PATHS
7. tsc --noEmit → fix semua error
8. git commit + push → Railway deploy
9. Smoke test: curl https://ai.boytenggara.com/news → 200 + HTML
10. Lapor: headline utama yang muncul + screenshot URL
```

---

## Aturan Wajib

- SEMUA LLM via `src/lib/llm.ts` (DeepSeek). JANGAN provider lain.
- `unstable_cache` wajib — jangan panggil DeepSeek tiap request
- Gambar: hotlink og:image sementara. JANGAN upload ke Railway volume.
- Token/key JANGAN ke log/response
- No force-push. Commit per step.
- Artikel HARUS ditulis ulang — JANGAN salin verbatim (copyright)
- Kalau feed gagal → skip gracefully, page tetap render dengan feed yang berhasil
