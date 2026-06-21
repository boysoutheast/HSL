# Blueprint — Testing/Scaling PR-2 (Temporal + Templates + Carry-over)

**Owner:** Boy · **Author:** Fable · **Executor:** Sonnet (VPS) · **Date:** 2026-06-21
**Repo:** hermes-support-web · **Lanjutan:** `testing-scaling-automation-blueprint.md` (PR-1 deployed `b68dea1`). PR-2 = Fase 4 (temporal) + Fase 6 (template) + 2 carry-over wajib dari audit PR-1.

> Konteks engine/schema sudah di blueprint PR-1 (jangan dihapus, masih dibutuhin). Ini delta-nya.

---

## 0. PRASYARAT (verifikasi DULU sebelum klaim Fase 4 jalan)
Fase 4 baca history `metric_snapshots`. PR-1 lapor "write guard blocked unknown env issue" → **capture e2e belum terbukti**. SEBELUM/saat PR-2:
- Pastiin minimal 1 campaign opt-in (`automationEnabled=true` + token valid) → scan nulis row `metric_snapshots`. Kalau masih 0 row, **kejar dulu kenapa** (token decrypt? canWriteToAdAccount reason?). Fase 4 percuma tanpa data.
- Lapor: `SELECT count(*), max(window_end) FROM metric_snapshots` + 1 sample row.

---

## 1. CARRY-OVER (b) — Snapshot WINDOW HARIAN (🟢 prioritas, deploy ASAP)

**Masalah:** PR-1 nyimpen snapshot pakai `insightWindow` campaign (default `maximum` = lifetime kumulatif). `roas_min_7d`/"sustained" di atas data lifetime = **flat, gak bermakna**.

**Fix di `scan-campaigns`:** snapshot HARUS nangkep metrik **window harian konsisten**, TERPISAH dari window yang dipakai rule eval.
- Tambah 1 call `getInsights(metaCampaignId, token, 'today')` KHUSUS buat snapshot (atau `last_1d`). Simpan nilai HARIAN itu ke `metric_snapshots`, bukan nilai lifetime.
- Rule eval tetap pakai `session.insightWindow` (terpisah). Snapshot = selalu harian.
- Bucket tetap unique per `(session, entity, windowEnd)`; windowEnd = **awal HARI** (`setHours(0,0,0,0)`) — 1 row per hari per campaign, di-upsert sepanjang hari dengan angka hari berjalan. (Ganti dari bucket-jam PR-1.)

**Kenapa penting:** ini ngubah APA yang kekumpul. Makin cepat deploy = makin cepat punya data harian bener buat Fase 4.

---

## 2. CARRY-OVER (a) — Anti-overscale CUMULATIVE 24 jam (🟡 safety)

**Masalah:** PR-1 guard cuma per-aksi (cap 1 fire ke +50%). 2 fire/hari bisa compound >50%.

**Fix di `scan-campaigns`** (ganti guard PR-1):
- Sebelum apply budget increase, hitung budget campaign **24 jam lalu** (dari snapshot harian kemarin ATAU `AutomationAction` budget SUCCEEDED terlama dlm 24j).
- `cumulativePct = (newBudget / budget24hAgo - 1) * 100`. Kalau > 50 → cap `newBudget` ke `budget24hAgo * 1.5`, log `overscale_guard_cumulative`, notify.
- Konstanta `MAX_DAILY_INCREASE_PCT = 50` server-side (user gak bisa bypass via rule).
- Pertahankan juga cap per-aksi PR-1 sebagai layer ke-2 (defense in depth).

---

## 3. FASE 4 — Metrik temporal turunan (🟡 sedang)

Engine TIDAK berubah (tetap leaf metric/operator/value). scan hitung metrik turunan dari `metric_snapshots` harian → masukin `MetricsMap`. Tambah ke `Metric`/`MetricsMap` (`src/lib/rule-engine.ts`):
| Metric baru | Definisi (dari snapshot harian N hari) | Buat rule |
|---|---|---|
| `roas_min_7d` | ROAS harian TERENDAH dlm 7 hari (≥1.5 = sustained) | scale-ready |
| `frequency_max_7d` | frequency tertinggi 7 hari | fatigue |
| `cpa_change_pct_3d` | % kenaikan CPA rata 3hr-terakhir vs 3hr-sebelumnya | stabilitas |
| `adset_age_days` | umur campaign/adset (dari MetaEntity createdTime atau snapshot pertama) | jangan-scale-baru |
| `days_with_data` | jumlah hari punya snapshot (guard: jangan eval temporal kalau <N hari) | safety |

**`src/lib/metrics-temporal.ts` (BARU):** `computeTemporalMetrics(sessionId, campaignEntityId): Promise<Partial<MetricsMap>>` — query snapshot ≤14 hari, hitung agregat. Pure read + arithmetic, NO call Meta.

**scan-campaigns:** panggil `computeTemporalMetrics`, merge ke `metricsMap` sebelum eval.

**Guard penting:** kalau `days_with_data < 3` (mis. baru mulai), metrik temporal = `null`. Rule yang refer metrik temporal otomatis gak match (evaluator: null → gak lolos operator). Jadi aman, gak fire dengan data setengah.

---

## 4. FASE 6 — Template research-aligned (🟡 sedang, butuh Fase 4 buat yg temporal)

Seed/tambah built-in template, **default status PAUSED** (opt-in, JANGAN auto-aktif). Format condition-tree PERSIS engine:
1. **Kill Loser (Screening):** `{op:AND,children:[{spend,gt,10000},{purchases,eq,0}]}` → PAUSE.
2. **Kill Boros:** `{op:AND,children:[{spend,gt,30000},{roas,lt,1}]}` → PAUSE.
3. **Scale Winner (Vertical):** `{op:AND,children:[{roas,gte,1.5},{purchases,gte,5},{adset_age_days,gte,7}]}` → `increase_pct 20`, `cooldownMinutes:2880`.
4. **Fatigue Guard:** `{frequency,gt,3.5}` → `decrease_pct 20`.
5. **Scale-Ready Gate (TARACARE):** `{op:AND,children:[{roas_min_7d,gte,1.5},{purchases,gte,5},{frequency,lt,3.5},{cpa_change_pct_3d,lte,20}]}` → `NOTIFY` "Campaign siap di-scale".

**UI rule-template picker:** template baru + 1 baris penjelasan awam tiap metrik (roas/frequency/cpa). Nyambung ke audit UX.

---

## 5. ACCEPTANCE
1. tsc clean · build exit 0 · `prisma migrate deploy` (kalau ada kolom baru — kemungkinan gak ada, kolom snapshot udah lengkap).
2. Snapshot harian: 1 hari = 1 row per campaign (windowEnd=awal hari), di-upsert. Bukan lagi per-jam.
3. `computeTemporalMetrics` unit test: kasih 7 hari snapshot dummy → `roas_min_7d`/`cpa_change_pct_3d`/`adset_age_days` kehitung bener; <3 hari → null.
4. Cumulative guard: simulasi 2 fire (+40% lalu +40% dlm 24j) → fire ke-2 ke-cap (cumulative >50%). Unit/integration test.
5. 5 template ke-seed PAUSED, lolos `parseConditionTree`+`evaluateRule` tanpa error.
6. Rule refer metrik temporal saat `days_with_data<3` → gak fire (null-safe).
7. Guard existing (write-guard, atomic, cooldown, per-aksi cap) UTUH.

## 6. SMOKE LIVE
- **S1** Scan → `metric_snapshots` 1 row/hari/campaign, nilai HARIAN (bukan lifetime — bandingin 2 hari beda).
- **S2** Cumulative guard: campaign test, 2× scale +40% paksa → ke-2 ke-cap. Log `overscale_guard_cumulative`. Readback Meta budget.
- **S3** Template Scale-Ready ke-load UI, default PAUSED, bahasa awam.
- **S4** Rule `roas_min_7d gte 1.5` di campaign dgn <3 hari data → gak fire (null-safe). 
- **S5 (follow-up ~7 hari):** setelah history cukup, `roas_min_7d` punya nilai valid → Scale-Ready bisa beneran match. Catat, jangan blokir.
- **S6** Regresi: rule lama + top-up + budget scale normal jalan.

## 7. EKSEKUSI & LAPORAN
- Branch `feat/testing-scaling-pr2`. Commit per bagian (carry-b → carry-a → Fase4 → Fase6). Jangan merge sendiri.
- DILARANG: auto-aktifin template; drop guard; bikin aksi multi-account/clone.
- Saran urutan: **carry-over (b) snapshot harian DULU + deploy** (biar data bener mulai numpuk), sisanya nyusul. Tapi boleh 1 PR kalau Fase 4 siap.
- LAPOR MAC AUDIT: `git diff --stat`, migration, unit test, smoke S1–S6, guard checklist, STATUS.

## 8. ⚠️ CLEANUP SETELAH DEPLOY
Setelah PR-2 deploy SUKSES, `git rm` **DUA** blueprint (PR-1 + PR-2) — fitur udah selesai:
`docs/blueprints/testing-scaling-automation-blueprint.md` + `docs/blueprints/testing-scaling-pr2-blueprint.md`. Commit `chore: cleanup deployed blueprints`. Lihat [[feedback-delete-blueprints-after-deploy]].
```
