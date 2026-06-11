import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { llmJson, llmConfigured, LlmError } from '@/lib/llm'
import { graphFetch, getMetaToken, MetaGraphError } from '@/lib/meta-graph'

export const dynamic = 'force-dynamic'

// ── Step 1: LLM expand free text → daftar nama lokasi terstruktur ────────────

interface LlmLocation {
  name: string // nama yang paling mungkin dikenali Meta (English, mis. "West Java")
  altName?: string // nama alternatif lokal (mis. "Jawa Barat")
  type: 'city' | 'region'
}

interface LlmExpansion {
  locations: LlmLocation[]
}

const EXPAND_SYSTEM = `Kamu adalah resolver lokasi untuk Meta Ads targeting di Indonesia.
Tugas: ubah deskripsi lokasi bebas dari user menjadi daftar lokasi terstruktur.

Aturan:
- "seluruh jawa" / "se-jawa" → semua PROVINSI di pulau Jawa: Banten, Jakarta, West Java, Central Java, Yogyakarta, East Java (type: region)
- "seluruh sumatera" → semua provinsi Sumatera (Aceh, North Sumatra, West Sumatra, Riau, Riau Islands, Jambi, South Sumatra, Bengkulu, Lampung, Bangka Belitung) (type: region)
- Nama provinsi → type: region. Nama kota/kabupaten → type: city.
- "name" WAJIB pakai nama English yang dipakai Meta (West Java bukan Jawa Barat, North Sumatra bukan Sumatera Utara, Special Region of Yogyakarta → Yogyakarta).
- "altName" isi nama Indonesia/lokalnya.
- Jabodetabek → Jakarta (region) + kota: Bogor, Depok, Tangerang, Tangerang Selatan, Bekasi.
- Maksimal 60 lokasi. Jangan duplikat.
- Kalau user sebut daerah ambigu, pilih interpretasi paling umum.

Output JSON: {"locations": [{"name": "...", "altName": "...", "type": "city"|"region"}]}`

// ── Step 2: Validasi tiap nama ke Meta Targeting Search → canonical key ──────

interface MetaGeoResult {
  key: string
  name: string
  type: string
  country_code?: string
  country_name?: string
  region?: string
  region_id?: number
}

async function searchMetaGeo(
  token: string,
  q: string,
  type: 'city' | 'region'
): Promise<MetaGeoResult | null> {
  try {
    const result = await graphFetch<{ data?: MetaGeoResult[] }>('search', token, {
      params: {
        type: 'adgeolocation',
        q,
        location_types: JSON.stringify([type]),
        country_code: 'ID',
        limit: '3',
      },
    })
    const candidates = (result.data ?? []).filter(
      (c) => c.type === type && (c.country_code === 'ID' || !c.country_code)
    )
    return candidates[0] ?? null
  } catch {
    return null
  }
}

// POST /api/admin/meta-tools/resolve-locations
// Body: { query: string, metaAccountId?: string }
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  if (!llmConfigured()) {
    return NextResponse.json(
      { error: 'AI belum dikonfigurasi. Set DEEPSEEK_API_KEY di Railway.' },
      { status: 503 }
    )
  }

  const body = await req.json().catch(() => null)
  const query = String(body?.query ?? '').trim()
  if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 })
  if (query.length > 500) {
    return NextResponse.json({ error: 'query max 500 karakter' }, { status: 400 })
  }

  const tokenData = await getMetaToken(auth.id, body?.metaAccountId ?? undefined)
  if (!tokenData) {
    return NextResponse.json(
      { error: 'Tidak ada Meta account terhubung — connect dulu di Meta Connections.' },
      { status: 400 }
    )
  }

  // Step 1: LLM expansion
  let expansion: LlmExpansion
  try {
    expansion = await llmJson<LlmExpansion>(EXPAND_SYSTEM, query)
  } catch (err) {
    const msg = err instanceof LlmError ? err.message : 'AI expansion gagal'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const items = (expansion.locations ?? [])
    .filter((l) => l?.name && (l.type === 'city' || l.type === 'region'))
    .slice(0, 60)

  if (items.length === 0) {
    return NextResponse.json(
      { error: 'AI tidak menemukan lokasi dari input itu. Coba lebih spesifik.' },
      { status: 422 }
    )
  }

  // Step 2: validasi tiap item ke Meta (canonical key dari Meta, bukan LLM)
  const resolved: Array<{ key: string; name: string; type: string; region?: string }> = []
  const unresolved: string[] = []
  const seenKeys = new Set<string>()

  try {
    // Batch 5 paralel biar nggak kena rate limit Meta
    for (let i = 0; i < items.length; i += 5) {
      const batch = items.slice(i, i + 5)
      const results = await Promise.all(
        batch.map(async (item) => {
          let match = await searchMetaGeo(tokenData.token, item.name, item.type)
          if (!match && item.altName) {
            match = await searchMetaGeo(tokenData.token, item.altName, item.type)
          }
          return { item, match }
        })
      )
      for (const { item, match } of results) {
        if (match && !seenKeys.has(`${match.type}:${match.key}`)) {
          seenKeys.add(`${match.type}:${match.key}`)
          resolved.push({
            key: match.key,
            name: match.name,
            type: match.type,
            region: match.region,
          })
        } else if (!match) {
          unresolved.push(item.altName ?? item.name)
        }
      }
    }
  } catch (err) {
    const msg = err instanceof MetaGraphError ? err.message : 'Meta location search gagal'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  return NextResponse.json({
    query,
    resolved,
    unresolved,
    summary: `${resolved.length} lokasi ter-resolve${unresolved.length > 0 ? `, ${unresolved.length} tidak ketemu` : ''}`,
  })
}
