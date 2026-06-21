/**
 * metrics-temporal.ts — Fase 4: Metrik temporal turunan dari MetricSnapshot harian.
 *
 * Fungsi: computeTemporalMetrics(sessionId, campaignEntityId)
 *   - Query snapshot ≤14 hari untuk campaign ini
 *   - Hitung agregat temporal: roas_min_7d, frequency_max_7d, cpa_change_pct_3d, adset_age_days, days_with_data
 *   - Guard: days_with_data < 3 → semua metrik temporal = null (aman, gak match)
 *   - Pure read + arithmetic — NO call Meta API.
 */
import { prisma } from '@/lib/prisma'

export interface TemporalMetrics {
  roas_min_7d: number | null
  frequency_max_7d: number | null
  cpa_change_pct_3d: number | null
  adset_age_days: number | null
  days_with_data: number | null
}

export async function computeTemporalMetrics(
  sessionId: string,
  campaignEntityId: string,
): Promise<TemporalMetrics> {
  const now = new Date()
  const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  // Ambil snapshot ≤14 hari untuk entity ini
  const snapshots = await prisma.metricSnapshot.findMany({
    where: {
      campaignSessionId: sessionId,
      metaEntityId: campaignEntityId,
      windowEnd: { gte: cutoff },
    },
    orderBy: { windowEnd: 'asc' },
    select: {
      windowEnd: true,
      roas: true,
      frequency: true,
      cpa: true,
      spend: true,
      purchases: true,
    },
  })

  if (snapshots.length === 0) {
    return {
      roas_min_7d: null,
      frequency_max_7d: null,
      cpa_change_pct_3d: null,
      adset_age_days: null,
      days_with_data: 0,
    }
  }

  // Kelompokkan per hari (unique windowEnd date)
  const dayMap = new Map<string, typeof snapshots[0]>()
  for (const snap of snapshots) {
    const dayKey = snap.windowEnd.toISOString().slice(0, 10) // YYYY-MM-DD
    // Simpan snapshot TERAKHIR per hari (upsert di scan bisa update dalam 1 hari)
    dayMap.set(dayKey, snap)
  }
  const days = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b))
  const daysWithData = days.length

  // Umur campaign dalam hari (dari snapshot pertama sampai sekarang)
  const firstDay = new Date(days[0][0] + 'T00:00:00Z')
  const ageDays = Math.max(1, Math.round((now.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000)))

  // Guard: <3 hari data → null semua (gak cukup data buat temporal)
  if (daysWithData < 3) {
    return {
      roas_min_7d: null,
      frequency_max_7d: null,
      cpa_change_pct_3d: null,
      adset_age_days: ageDays,
      days_with_data: daysWithData,
    }
  }

  // ── roas_min_7d: ROAS harian TERENDAH dalam 7 hari terakhir ──
  const last7Days = days.slice(-7)
  const roasValues = last7Days
    .map(([, s]) => s.roas)
    .filter((r): r is number => r !== null && r !== undefined)
  const roas_min_7d = roasValues.length > 0 ? Math.min(...roasValues) : null

  // ── frequency_max_7d: frequency tertinggi dalam 7 hari ──
  const freqValues = last7Days
    .map(([, s]) => s.frequency)
    .filter((f): f is number => f !== null && f !== undefined)
  const frequency_max_7d = freqValues.length > 0 ? Math.max(...freqValues) : null

  // ── cpa_change_pct_3d: % kenaikan CPA rata-rata 3hr-terakhir vs 3hr-sebelumnya ──
  let cpa_change_pct_3d: number | null = null
  if (days.length >= 6) {
    const last3 = days.slice(-3).map(([, s]) => s.cpa).filter((c): c is number => c !== null)
    const prev3 = days.slice(-6, -3).map(([, s]) => s.cpa).filter((c): c is number => c !== null)
    if (last3.length > 0 && prev3.length > 0) {
      const avgLast3 = last3.reduce((a, b) => a + b, 0) / last3.length
      const avgPrev3 = prev3.reduce((a, b) => a + b, 0) / prev3.length
      if (avgPrev3 > 0) {
        cpa_change_pct_3d = ((avgLast3 - avgPrev3) / avgPrev3) * 100
      }
    }
  }

  return {
    roas_min_7d,
    frequency_max_7d,
    cpa_change_pct_3d,
    adset_age_days: ageDays,
    days_with_data: daysWithData,
  }
}
