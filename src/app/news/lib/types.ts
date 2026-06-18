// News portal — tipe data

export interface RawArticle {
  title: string
  url: string
  source: string // 'Kompas' | 'Detik' | 'CNN Indonesia' | 'Liputan6' | 'Tribun'
  publishedAt: string
  excerpt: string
  imageUrl: string | null
}

export interface RewrittenStory {
  headline: string // kuat, curiosity gap, max 12 kata
  subheadline: string // 1 kalimat konteks
  body: string // 4-6 paragraf, rewritten, NOT verbatim copy
  sources: { name: string; url: string }[]
  imageUrl: string // og:image dari artikel terkuat
  category: string // Nasional | Ekonomi | Teknologi | Dunia
  readTimeMinutes: number
}

export interface NewsAIResponse {
  mainStory: RewrittenStory
  relatedStories: [RewrittenStory, RewrittenStory]
  fillerIndices: number[]
}
