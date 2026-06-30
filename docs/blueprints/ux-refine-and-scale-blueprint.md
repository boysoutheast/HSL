# Blueprint: UX Refine + Import/Scale Hardening

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION · Tanggal: 2026-06-30
**Eksekutor:** Sonnet VPS · **Auditor final:** Fable (audit total + cross-check origin/main)
**Konteks:** Polish setelah Testing Lab + integrated-pickers landing. Modul **import/scale/maintain** secara struktural sudah lengkap (phase editor, importStatus badge, template picker, 15 seed templates inc. Scale Test Winner, anti-overscale guard +50%/day) — tapi ada beberapa gap UX + 2 logic yang nyesatin user.

---

## 0. RINGKASAN STATE (yang sudah ADA, jangan dibikin lagi)

**Import flow:** wizard → POST `/api/admin/campaign-sessions/import` → cron `sync-campaigns` upsert MetaEntity + isi `dailyBudget`/`budgetMode`.
**Phase editor:** `PhaseEditor` di `src/app/campaign-monitor/[id]/page.tsx:49` (PATCH `phase`).
**importStatus badge:** ada di list + detail (page.tsx:84) — Syncing/Sync gagal/Synced.
**Template picker:** `src/app/campaign-monitor/[id]/rules/new/page.tsx` — readable (bukan JSON), inline editor threshold.
**Seed templates:** 15 termasuk Kill Loser, Scale Winner Vertical, Fatigue Guard, Scale-Ready Gate, Kill Boros, 🧪 Scale Test Winner (`TEST_OUTCOME`).
**Anti-overscale guard:** `scan-campaigns` MAX_DAILY_INCREASE_PCT=50, dua layer (cumulative 24h + per-action).
**Executor action:** `scan-campaigns` (line 247) + `automation-actions/[id]` & `campaign-sessions/[id]/actions` — `UPDATE_BUDGET` & `PAUSE` udah jalan.

**Yang KURANG (target blueprint ini):** lihat segmen di bawah.

---

## 1. ATURAN GLOBAL (WAJIB — semua segmen)

1. Branch `main`. Sebelum tiap segmen: `git pull --rebase origin main`.
2. `npx tsc --noEmit` 0 error baru + `npm run build` sukses sebelum commit.
3. **Tidak ada perubahan schema** kecuali Segmen 4 yang tambah 1 kolom nullable (jelas additive). Migration: `cp prisma/schema.prisma prisma/schema.prisma.bak` dulu.
4. Tiru pola existing — jangan invent ulang. Sebelum nulis komponen, baca file pattern sejenis (ConfirmDialog, EmptyState, `useState<…>(false)` loading, `setError(string)`).
5. **ANTI-FABRIKASI:** klaim commit WAJIB sertakan output asli `git rev-parse HEAD` + `git log --oneline -1`. Klaim grep WAJIB sertakan command + output mentah.
6. **GUARDRAIL KREDENSIAL:** dilarang reset/ubah kredensial prod, dilarang dump secret ke disk, dilarang credential di code/log/commit. Pakai akun login yang ada untuk smoke.
7. Hermes API (`/api/hermes/*`) tidak boleh berubah perilaku.
8. No force-push. Tiap segmen: commit + push + SONNET REPORT (§7) + update ledger (§2).

---

## 2. SEGMENT LEDGER (Sonnet update tiap selesai)

| # | Segmen | Status | Commit | Catatan |
|---|--------|--------|--------|---------|
| 1 | Progress bar arah-benar untuk metrik lower-is-better (LIB) | DONE | 2bfe7d1 | tsc 0 + build sukses + push |
| 2 | Loading + error state di TestingPage (sync, declare, archive, create) | DONE | 0a4a9c4 | tsc 0 + build sukses + push |
| 3 | Mobile compare grid + state mutation cleanup | DONE | 75f70d5 | tsc 0 + build sukses + push |
| 4 | Sync retry + error message visible (import_error_message kolom additive) | TODO | — | unblock user yang `sync_failed` |
| 5 | Sync verify (audit) | TODO | — | end-to-end pass |

Status: `TODO` → `DOING` → `DONE` (atau `BLOCKED`). Urut 1→5.

---

## 3. SEGMEN 1 — Progress bar arah-benar (LIB metric)

**Masalah konkret:** di `TestingPage.tsx` Test Card, progress bar tiap varian dihitung `pct = nilai/maxAbs * 100` (sekitar baris 378–399). Buat metrik **higher-is-better** (ROAS/CTR/CVR) ini benar. Tapi buat **lower-is-better** (CPC/CPL/CPM/CPLC/CPA/COST_PER_LPV) ini **kebalik** — varian dengan CPC TERENDAH (= pemenang) malah dapet bar TERPENDEK, sementara `isLeader` styling tetep nempel ke nilai best. User liat bar panjang → kira menang. Nyesatin.

**Fix (rumus eksplisit, jangan improvisasi):**
- Tentukan apakah successMetric `HIB` (higher-is-better) atau `LIB`.
- Kumpulin `values = variants.map(v => getMetricValue(v, sm)).filter(x => x !== null && x > 0)`.
- Kalau `values` kosong → semua `pct = 0`.
- Kalau HIB: `pct = (val / Math.max(...values)) * 100`.
- Kalau LIB: `pct = (Math.min(...values) / val) * 100`.
- Clamp `Math.max(3, Math.min(100, pct))`.
- Hasilnya: **varian pemenang selalu bar TERPANJANG** (≈100%), apapun metriknya. `isLeader` styling tetap sesuai (sudah benar di logic existing).

**Acceptance:** Test card dengan successMetric=CPC, varian A CPC=Rp500, varian B CPC=Rp2000 → A bar ≈100%, B bar ≈25%. Sertakan screenshot/deskripsi atau hitung manual di report. tsc + build clean.

---

## 4. SEGMEN 2 — Loading + error state di TestingPage

**Masalah:** semua handler `syncMetrics`/`declareWinner`/`archiveTest`/`createTest` pakai `catch { /* silent */ }`. Klik gagal → user gak dikasih tau. Klik dobel → request dobel.

**Fix:**
- Tambah state `actionLoading: Map<string, 'sync'|'declare'|'archive'>` di TestingPage (key = testId) + `actionError: string | null`.
- `syncMetrics`: set loading, kalau `!res.ok` → `setActionError('Sync gagal: '+ (data.error ?? res.status))`. Tampilkan tombol Sync dengan label "Syncing…" + disabled saat aktif. Kalau berhasil → toast/banner "Synced N varian" (atau alert inline 2s).
- `declareWinner`: handle error mirip + tutup modal cuma kalau `res.ok`.
- `archiveTest`: error → tampilkan banner.
- `createTest` (drawer): tambah state `createError`. Kalau `!res.ok` → render banner merah di atas tombol Buat Test, JANGAN tutup drawer.
- Banner error: pakai pola `<div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">` (sudah dipakai di `admin-users/page.tsx:151` — tiru).

**Acceptance:** force-error test (mis. hit endpoint dengan id ngawur via DevTools) — banner muncul, klik gak nge-disable selamanya, sukses path bersihin error. tsc + build clean.

---

## 5. SEGMEN 3 — Mobile compare grid + state cleanup

**A. Variant compare di mobile (`TestingPage.tsx` ~baris 369):**
`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4` + `border-r border-stone-100 last:border-r-0` — di mobile (1 kolom) `border-r` salah arah. Fix:
- Ganti jadi `divide-y md:divide-y-0 md:divide-x divide-stone-100` di parent grid (atau hapus `border-r` dan tambah `border-b md:border-b-0 md:border-r last:border-b-0 md:last:border-r-0` di child). Pilih yang lebih bersih — tujuan: divider horizontal di mobile, vertikal di ≥md.

**B. State mutation cleanup (`TestingPage.tsx` baris ~739–741):**
`new Map(showAdPicker.set(i, next))` — `.set()` me-mutate Map LAMA sebelum dibungkus. React kadang gak rerender. Fix:
- `setShowAdPicker(prev => { const m = new Map(prev); m.set(i, next); return m })`.

**Acceptance:** buka drawer di viewport mobile (≤640px) — varian numpuk vertikal, divider horizontal antar varian (bukan kosong/double). Toggle Pilih/Manual tetap responsif. tsc + build clean.

---

## 6. SEGMEN 4 — Sync retry + error visible (campaign import)

**Masalah:** `CampaignSession.importStatus = 'sync_failed'` ditulis ke DB tapi **tidak ada pesan error apa-apa** + **tidak ada tombol retry di UI**. User stuck.

**A. Schema (additive):**
- Tambah `importError String? @map("import_error_message")` di `CampaignSession`.
- Migration: `cp prisma/schema.prisma prisma/schema.prisma.bak`, lalu `npx prisma migrate dev --name add_import_error_message`, `npx prisma generate`.

**B. Cron sync write the error:**
- `src/app/api/cron/sync-campaigns/route.ts` baris 62 & 197 (dua tempat set `importStatus: 'sync_failed'`): isi juga `importError` dengan pesan singkat (ambil dari `error.message ?? String(error)`, truncate ke 500 char). Saat sukses, set `importError: null`.

**C. Resync endpoint (manual trigger):**
- Buat route baru `src/app/api/admin/campaign-sessions/[id]/resync/route.ts` (POST).
- requireAuth + ownership cek (`userId`). Set `importStatus: 'pending_sync'`, `importError: null`, lalu return `{ ok: true }`. Tunggu cron 5 menit (atau jelaskan ke user). JANGAN panggil cron secret dari server-side; ini bukan executor langsung — cuma reset state biar cron pick up lagi.
- Catatan keamanan: jangan invoke full sync logic inline di sini (cron pakai `x-cron-secret` justru karena beratnya batch + Meta API call). Cukup reset state.

**D. UI: tampilkan error + tombol retry di campaign detail:**
- `src/app/campaign-monitor/[id]/page.tsx` di sekitar badge importStatus (baris 78–86): kalau `importStatus === 'sync_failed'`:
  - Tampilkan `session.importError` di bawah badge (text-xs text-red-600, max 2 baris, truncate).
  - Tombol kecil "Sync ulang" → POST `/api/admin/campaign-sessions/${id}/resync` → set badge balik ke Syncing + tampilkan toast "Antri sync ulang — coba lagi dalam ~5 menit". Tombol disabled saat loading.

**Acceptance:** trigger sync_failed (mis. ad account token expired / id ngawur), buka detail → pesan error tampil + tombol Sync ulang. Klik → `importStatus` jadi `pending_sync`, badge balik Syncing, `importError` `null`. Cron berikutnya proses. Sertakan readback DB 1 record di report. tsc + build clean.

---

## 7. SEGMEN 5 — Sync verify (audit)

**Tujuan:** Sonnet jalanin checklist akhir sebagai bukti tidak ada regresi. AUDIT, bukan koding (kecuali nemu masalah jelas — STOP & lapor).

1. `npx tsc --noEmit` → paste tail.
2. `npm run build` → konfirmasi "Compiled successfully" + "✓ Generating static pages (44/44)".
3. Grep mentah: `grep -rnE "/\* silent \*/" src/app/ads src/app/campaign-monitor` → harus 0 (Segmen 2 udah ganti). Paste output.
4. Grep: `grep -rnE "border-r" src/app/ads/TestingPage.tsx` → konfirmasi sudah pakai divide atau border-bottom mobile-aware. Paste.
5. Grep: `grep -rE "new Map\\(.+\\.set\\(" src/app/ads/TestingPage.tsx` → harus 0.
6. Confirm `importError` kolom muncul di Prisma client: `grep -nE "importError" prisma/schema.prisma` → ada.
7. Smoke (kalau bisa): GET `/api/admin/campaign-sessions/<id>` di akun login — JSON balik berisi `importError` field (nullable).

**Acceptance:** report berisi 7 bukti di atas. tsc + build sukses.

---

## 8. FORMAT SONNET REPORT (tiap segmen — wajib)

```
## SONNET REPORT — Segmen N: [judul]
Commit: <git rev-parse HEAD>          ← output asli
git log -1: <git log --oneline -1>    ← output asli

### Yang dikerjakan
- file + 1 baris

### Acceptance (bukti)
- tsc tail
- build tail
- screenshot manual / readback / grep mentah

### MAC Audit (self)
1. Objective vs hasil
2. Side-effect / regresi
3. Asumsi belum kebukti

### Ledger: Segmen N → DONE (tabel §2 updated + commit)
### Next: Segmen N+1
```

Setelah 5 segmen DONE → ringkasan + semua commit. Fable audit total.

## 9. DEFINITION OF DONE

- 5 ledger DONE, 5 SONNET REPORT dengan commit asli.
- tsc 0 error baru; build sukses 44/44 pages.
- Progress bar pemenang selalu terpanjang apapun metriknya.
- Tidak ada silent catch di TestingPage.
- Mobile compare divider benar.
- Campaign sync_failed dapat dilihat alasannya + bisa di-retry oleh user.
- Tidak ada perubahan schema lain selain `importError` (additive).
- Tidak ada kredensial di code/log/commit.
