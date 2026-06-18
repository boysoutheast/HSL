'use client'

import type { RewrittenStory, RawArticle } from './lib/types'

// ─── Helpers ───

function timeAgo(publishedAt: string): string {
  const diff = Date.now() - new Date(publishedAt).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'Kurang dari 1 jam lalu'
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
}

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    Nasional: 'bg-blue-600',
    Ekonomi: 'bg-emerald-600',
    Teknologi: 'bg-violet-600',
    Dunia: 'bg-amber-600',
    Olahraga: 'bg-rose-600',
    Hiburan: 'bg-fuchsia-600',
  }
  return map[cat] ?? 'bg-gray-600'
}

// ─── Sub-components ───

function HeroSection({ story }: { story: RewrittenStory }) {
  return (
    <section className="relative w-full">
      <div className="aspect-[16/9] max-h-[480px] overflow-hidden bg-stone-200 rounded-xl">
        {story.imageUrl ? (
          <img
            src={story.imageUrl}
            alt={story.headline}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            loading="eager"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400 text-lg">
            Hermes News
          </div>
        )}
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`${categoryColor(story.category)} text-white text-xs font-semibold px-3 py-1 rounded-full`}
          >
            {story.category}
          </span>
          <span className="text-stone-500 text-sm">{story.readTimeMinutes} menit baca</span>
        </div>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-stone-900 leading-tight">
          {story.headline}
        </h1>
        <p className="text-lg md:text-xl text-stone-600 leading-relaxed">{story.subheadline}</p>
        <div className="text-xs text-stone-400 space-x-1">
          <span>Sumber:</span>
          {story.sources.map((s, i) => (
            <span key={i}>
              {i > 0 && <span>, </span>}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-600 hover:underline font-medium"
              >
                {s.name}
              </a>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function RelatedCard({ story }: { story: RewrittenStory }) {
  return (
    <div className="flex flex-col gap-3 group">
      <div className="aspect-[16/9] overflow-hidden bg-stone-200 rounded-lg">
        {story.imageUrl ? (
          <img
            src={story.imageUrl}
            alt={story.headline}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm">
            Hermes News
          </div>
        )}
      </div>
      <div className="space-y-1">
        <span
          className={`${categoryColor(story.category)} text-white text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block`}
        >
          {story.category}
        </span>
        <h3 className="font-bold text-stone-900 group-hover:underline leading-snug">
          {story.headline}
        </h3>
        <p className="text-sm text-stone-500 line-clamp-2">{story.subheadline}</p>
        <div className="text-xs text-stone-400">
          <span>Sumber: </span>
          {story.sources.map((s, i) => (
            <span key={i}>
              {i > 0 && ', '}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-600 hover:underline"
              >
                {s.name}
              </a>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function FillerCard({ article }: { article: RawArticle }) {
  return (
    <div className="flex flex-col gap-2 group">
      <div className="aspect-[4/3] overflow-hidden bg-stone-200 rounded-lg">
        {article.imageUrl ? (
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs">
            Hermes News
          </div>
        )}
      </div>
      <div>
        <h4 className="font-semibold text-stone-900 text-sm leading-snug group-hover:underline line-clamp-2">
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            {article.title}
          </a>
        </h4>
        <div className="flex items-center gap-2 text-xs text-stone-400 mt-1">
          <span>{article.source}</span>
          <span>·</span>
          <span>{timeAgo(article.publishedAt)}</span>
        </div>
      </div>
    </div>
  )
}

function TrendingSidebar({ articles }: { articles: RawArticle[] }) {
  return (
    <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
      <h3 className="font-bold text-stone-900 text-lg mb-4 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-red-600 rounded-full inline-block" />
        Trending
      </h3>
      <ol className="space-y-4">
        {articles.slice(0, 5).map((a, i) => (
          <li key={i} className="flex gap-3">
            <span className="text-red-600 font-bold text-lg leading-none mt-0.5 shrink-0 w-5 text-right">
              {i + 1}
            </span>
            <div>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-stone-900 hover:underline leading-snug"
              >
                {a.title}
              </a>
              <p className="text-xs text-stone-400 mt-0.5">{a.source} · {timeAgo(a.publishedAt)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function NavBar() {
  const categories = ['Nasional', 'Ekonomi', 'Teknologi', 'Dunia', 'Olahraga', 'Hiburan']
  return (
    <header className="border-b border-stone-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Hermes <span className="text-red-600">News</span>
          </h1>
          <a
            href="/"
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            ← Dashboard
          </a>
        </div>
        <nav className="flex gap-4 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <a
              key={cat}
              href="#"
              className="text-sm font-medium text-stone-600 hover:text-red-600 transition-colors whitespace-nowrap"
            >
              {cat}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}

// ─── Main Layout ───

interface Props {
  mainStory: RewrittenStory
  relatedStories: RewrittenStory[]
  fillerArticles: RawArticle[]
  allArticles: RawArticle[]
}

export default function NewsLayout({ mainStory, relatedStories, fillerArticles, allArticles }: Props) {
  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sys">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* Hero */}
        <HeroSection story={mainStory} />

        {/* Body artikel utama */}
        <div className="prose prose-stone max-w-none text-stone-700 leading-relaxed text-base space-y-4">
          {mainStory.body.split('\n').filter(Boolean).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {/* Related + Trending — 2 kolom desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="font-bold text-xl text-stone-900 mb-5 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-red-600 rounded-full inline-block" />
              Berita Terkait
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {relatedStories.map((story, i) => (
                <RelatedCard key={i} story={story} />
              ))}
            </div>
          </div>

          <div>
            <TrendingSidebar articles={allArticles} />
          </div>
        </div>

        {/* Filler grid — 3 kolom */}
        {fillerArticles.length > 0 && (
          <section>
            <h2 className="font-bold text-xl text-stone-900 mb-5 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-stone-400 rounded-full inline-block" />
              Berita Lainnya
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {fillerArticles.map((article, i) => (
                <FillerCard key={i} article={article} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-stone-200 mt-12 py-6 text-center text-xs text-stone-400">
        Hermes News &copy; {new Date().getFullYear()} — Portal berita otomatis dari 5 portal Indonesia.
        Seluruh artikel ditulis ulang oleh AI. Sumber asli tercantum di setiap artikel.
      </footer>
    </div>
  )
}
