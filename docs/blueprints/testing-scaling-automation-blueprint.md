# Blueprint — Otomasi Testing & Scaling (Rule-Engine End-to-End)

**Owner:** Boy · **Author:** Fable · **Executor:** Sonnet (VPS) · **Date:** 2026-06-19
**Repo:** hermes-support-web · **Goal:** Bikin rule-engine sanggup mengeksekusi metodologi testing→scaling (research deep-dive) yang FEASIBLE di arsitektur direct-API single-account: metrik baru, window waktu, history snapshot, kondisi temporal, guard anti-overscale, + template scale-ready.

> ⚠️ Ini blueprint TERBESAR. Dependency berurutan — kerjain per fase, JANGAN loncat. Fase 1–3 kecil & langsung berguna + mulai numpuk data. Fase 4–6 butuh fase sebelumnya.

---

## 0. SCOPE & PRINSIP

### Dikerjain (feasible direct-API, single account):
Metrik frequency+CPA, window insights, capture MetricSnapshot, kondisi temporal (sustained/delta), anti-overscale guard, umur-adset gate, template research-aligned + scale-ready gate.

### 🚫 OUT OF SCOPE (era-worker / fitur masa depan — JANGAN dikerjain, lapor aja):
- **Horizontal scaling** (clone winner → LAL 1%/3%/Broad) — butuh aksi create-audience/create-adset.
- **Fleet** (multi-account orchestration).
- **Creative rotation terjadwal** ("2 creative/minggu").
Ketiganya = fitur duplicate-campaign + Hermes worker yang sudah Boy tetapkan "nanti".

### Prinsip aman (UANG NYATA):
- Angka research = **hipotesis**, bukan hukum. Semua template baru default **status PAUSED/opt-in**, jangan auto-aktif.
- Aksi budget tetap lewat write-guard ownership + PAUSED-safe. Anti-overscale guard wajib.
- Engine tetap simple: kondisi temporal di-EXPOSE sebagai **metric turunan** di MetricsMap (bukan operator baru) — evaluator gak berubah.

---

## 1. FASE 1 — Metrik baru: frequency + CPA (🟢 kecil)

**`src/lib/meta-client.ts` `getInsights`:**
- Tambah `frequency` ke `fields` (Meta insight field `frequency`). Parse → `InsightResult.frequency: number | null`.
- (clicks/spend udah ada.) Tambah `linkClicks` kalau perlu cplc, opsional.

**`src/lib/rule-engine.ts`:**
- `Metric` union: tambah `'frequency' | 'cpa'`.
- `MetricsMap`: tambah `frequency: number | null`, `cpa: number | null`.

**`src/app/api/cron/scan-campaigns/route.ts`** (build metricsMap, ~line 104):
```ts
const cpa = insights.purchases > 0 ? insights.spend / insights.purchases : null
const metricsMap: MetricsMap = {
  spend: insights.spend, roas: insights.purchaseRoas ?? 0,
  cpc: insights.cpc ?? 0, ctr: insights.ctr ?? 0,
  purchases: insights.purchases, impressions: insights.impressions,
  frequency: insights.frequency ?? null,
  cpa,
  // + metric temporal (Fase 4)
}
```
**Hasil:** rule `frequency lt 3.5`, `cpa lte 30000` langsung bisa.

---

## 2. FASE 2 — Window insights configurable (🟢 kecil-sedang)

Sekarang scan pakai `getInsights(campaignId, token, 'maximum')` = lifetime. Research butuh per-periode.

**Migration:** `CampaignSession.insightWindow String @default("maximum")` (nilai: `today|last_3d|last_7d|last_14d|maximum`).
- Mapping ke Meta `date_preset`: today→`today`, last_7d→`last_7d`, dst.

**scan-campaigns:** ambil `session.insightWindow`, lempar ke `getInsights(..., datePreset)`.
**UI (campaign detail Automation):** dropdown "Periode evaluasi" (default Lifetime). Kecil.

> Catatan: window = RATA-RATA periode. "Sustained tiap hari" = Fase 4 (history), bukan ini.

---

## 3. FASE 3 — Mulai NULIS MetricSnapshot di scan (🟢 kecil, fondasi temporal)

`MetricSnapshot` (tabel udah ada: `spend, roas, frequency, cplc, windowEnd`, unique `(campaignSessionId, metaEntityId, windowEnd)`). Sekarang **gak ada yang ngisi** (cuma endpoint worker `/api/internal/monitor/metrics/batch` yang mati). 

**Migration:** tambah ke `MetricSnapshot`: `purchases Int?`, `cpa Float?`, `cpc Float?`, `ctr Float?` (biar temporal lengkap).

**scan-campaigns** (sesudah getInsights, sebelum eval rule):
```ts
const windowEnd = new Date(now); windowEnd.setMinutes(0,0,0) // bucket per jam (idempotent via unique)
await prisma.metricSnapshot.upsert({
  where: { campaignSessionId_metaEntityId_windowEnd: { campaignSessionId: session.id, metaEntityId: metaCampaignId, windowEnd } },
  update: { spend: insights.spend, roas: insights.purchaseRoas ?? null, frequency: insights.frequency ?? null, purchases: insights.purchases, cpa, cpc: insights.cpc ?? null, ctr: insights.ctr ?? null },
  create: { campaignSessionId: session.id, metaEntityId: metaCampaignId, windowEnd, spend: insights.spend, roas: insights.purchaseRoas ?? null, frequency: insights.frequency ?? null, purchases: insights.purchases, cpa, cpc: insights.cpc ?? null, ctr: insights.ctr ?? null },
})
```
**Hasil:** history mulai keisi DARI SEKARANG. Makin cepat deploy = makin cepat punya 7 hari data buat Fase 4. (Idempotent: bucket per jam + upsert, scan tiap 5 menit gak bikin duplikat ledakan.)

---

## 4. FASE 4 — Metrik temporal turunan (🟡 sedang, butuh Fase 3 + akumulasi)

Engine TIDAK berubah. scan menghitung metrik turunan dari MetricSnapshot history lalu masukin ke MetricsMap. Tambah ke `Metric`/`MetricsMap`:
- `roas_min_7d` — ROAS harian terendah dlm 7 hari (≥1.5 = sustained). 
- `cpa_change_pct_3d` — % kenaikan CPA 3 hari terakhir vs sebelumnya.
- `days_active` / `adset_age_days` — umur (dari MetaEntity createdTime / first snapshot).
- `frequency_max_7d` — frequency tertinggi 7 hari.

**scan-campaigns** sebelum eval: query snapshot 7–14 hari terakhir untuk campaign, hitung agregat di atas, masukin metricsMap. (Pure read + arithmetic, gak ada call Meta tambahan.)

Mapping research → rule (sekarang BISA):
| Research | Rule |
|---|---|
| ROAS≥1.5 sustained 7hr | `roas_min_7d gte 1.5` |
| Frequency<3.5 | `frequency lt 3.5` (atau `frequency_max_7d lt 3.5`) |
| CPA stabil <20%/3hr | `cpa_change_pct_3d lte 20` |
| ≥5 purchase | `purchases gte 5` |
| Jangan scale adset <7hr | `adset_age_days gte 7` (sbg syarat AND di rule scale) |

---

## 5. FASE 5 — Anti-overscale guard (🟡 sedang, KESELAMATAN)

Research: scale >50%/hari → reset Learning Phase. Engine sekarang gak nyegah.

**scan-campaigns**, di blok apply budget increase (sebelum `updateBudget`):
- Hitung total kenaikan budget campaign ini dalam 24 jam terakhir dari `AutomationAction` (actionType budget, SUCCEEDED) ATAU dari snapshot budget awal-hari.
- Kalau (budget baru / budget 24j lalu - 1) > 0.5 → **CAP** ke maksimal +50%/hari ATAU skip + log `skipped_overscale_guard` + notify. JANGAN langsung apply.
- Hard cap konstanta `MAX_DAILY_BUDGET_INCREASE_PCT = 50` (server-side, bukan dari rule — biar user gak bisa bypass dengan set %gede).

---

## 6. FASE 6 — Template research-aligned + Scale-Ready (🟡 sedang, butuh 1–4)

Tambah/seed built-in template (default status **PAUSED**, opt-in). Format PERSIS condition-tree engine:
1. **Kill Loser — Screening:** `{op:AND, children:[{spend,gt,10000},{purchases,eq,0}]}` → `actionType:PAUSE`. cooldown panjang.
2. **Scale Winner — Vertical:** `{op:AND, children:[{roas,gte,1.5},{purchases,gte,5},{adset_age_days,gte,7}]}` → `increase_pct 20`, `cooldownMinutes:2880` (48h). (cooldown 48h = otomatis hormatin <50%/hari.)
3. **Fatigue Guard:** `{frequency,gt,3.5}` → `decrease_pct 20` atau PAUSE.
4. **Scale-Ready Gate (compound TARACARE):** `{op:AND, children:[{roas_min_7d,gte,1.5},{purchases,gte,5},{frequency,lt,3.5},{cpa_change_pct_3d,lte,20}]}` → aksi `NOTIFY` "Campaign siap di-scale" (atau auto `increase_pct 20` kalau user mau agresif).
5. **Kill Boros:** `{op:AND,children:[{spend,gt,30000},{roas,lt,1}]}` → PAUSE. (Hormatin "jangan kill <Rp30K".)

**UI rule-template picker:** tampilin template baru dgn bahasa awam + penjelasan singkat tiap metrik (frequency, CPA, ROAS) — biar nyambung ke audit UX "orang awam".

---

## 7. MIGRATIONS (ringkas)
1. `CampaignSession.insightWindow String @default("maximum")` (Fase 2).
2. `MetricSnapshot` + `purchases Int?`, `cpa Float?`, `cpc Float?`, `ctr Float?` (Fase 3).
Semua additive, IF NOT EXISTS, `@map` snake_case (inget pelajaran P2022 — cek `@map` tiap field).

---

## 8. ACCEPTANCE
1. tsc clean · build exit 0 · migration jalan (`prisma migrate deploy`).
2. Fase 1: rule `frequency`/`cpa` ke-evaluasi (unit test evaluateRule + 2 metric baru).
3. Fase 3: setelah 1 scan, ada row di `metric_snapshots` (readback DB) — upsert idempotent (scan 2× = 1 row per bucket jam).
4. Fase 4: metrik turunan kehitung bener dari ≥2 hari snapshot dummy (unit test arithmetic).
5. Fase 5: simulasi rule scale +60% → guard CAP ke +50%/skip + log + notify (TIDAK apply 60%).
6. Fase 6: 5 template ke-seed status PAUSED, format lolos `parseConditionTree` + `evaluateRule` tanpa error.
7. Guard existing (write-guard ownership, inflight, atomic) UTUH.

## 9. SMOKE LIVE (ai.boytenggara.com, ad account billing)
- **S1** Scan jalan → `metric_snapshots` keisi (DB readback, frequency non-null).
- **S2** Rule `frequency gt 999` (mustahil) → gak fire; `frequency gt 0` → fire (bukti metric kebaca).
- **S3** Rule scale +60% di campaign test → anti-overscale CAP ke +50% (readback budget Meta + log `skipped_overscale_guard`/capped).
- **S4** Template Scale-Ready ke-load di UI, bahasa awam kebaca.
- **S5 (tunda 7 hari):** `roas_min_7d` mulai punya nilai valid setelah history numpuk — catat sebagai follow-up, jangan blokir deploy.
- **S6 Regresi:** rule lama (roas/spend/ctr) + top-up + budget scale normal masih jalan.
Jujur: temporal (S5) baru kebukti penuh setelah akumulasi — deploy lebih awal = lebih cepat valid.

## 10. EKSEKUSI & LAPORAN
- Branch `feat/testing-scaling-automation`. Commit per FASE (1→6). Jangan merge sendiri.
- DILARANG: drop guard existing; bikin aksi clone/multi-account (out of scope); auto-aktifin template (default PAUSED).
- LAPOR per fase: `git diff --stat`, migration status, unit test hasil, `grep` metric baru kepakai, build, smoke S1–S6, STATUS. Format MAC AUDIT REPORT.

## 11. ⚠️ CLEANUP SETELAH DEPLOY
Setelah deploy SUKSES, `git rm docs/blueprints/testing-scaling-automation-blueprint.md` (commit `chore: cleanup deployed blueprint`). Aturan: blueprint sekali pakai. Lihat [[feedback-delete-blueprints-after-deploy]].

---

## 12. URUTAN REALISTIS (saran)
Deploy **Fase 1+2+3 dulu** (kecil, langsung guna + MULAI numpuk snapshot hari ini). Fase 4 (temporal) baru worth setelah ~7 hari data. Fase 5 (guard) bisa barengan 1-3 (keselamatan, gak butuh history). Fase 6 nyusul tergantung 4. Jadi: **PR-1 = Fase 1,2,3,5** · **PR-2 = Fase 4,6** (~1 minggu kemudian). Jangan tahan semua nunggu temporal.
```
