# Blueprint — Tambah Creative Top-Up dari Media Library / Upload (bukan URL)

**Owner:** Boy · **Author:** Fable · **Executor:** Sonnet (VPS) · **Date:** 2026-06-19
**Repo:** hermes-support-web · **Goal:** Ganti input creative top-up dari "tempel URL" (merepotkan) jadi 2 cara termudah: **(1) pilih dari Media Library**, **(2) upload langsung**. End-to-end: pilihan itu beneran jadi gambar di ad Meta saat top-up.

---

## 0. TEMUAN AUDIT (kenapa ini bukan cuma kerjaan UI)

Backend POST `creative-pool` **SUDAH** terima `mediaAssetId` (route.ts:58,99) — tapi flow eksekusinya BOLONG:

🔴 **BUG KRITIS** — `src/app/api/cron/topup-campaigns/route.ts:144`:
```ts
mediaUrl: poolItem.creativeUrl ?? undefined,   // ← mediaAssetId DIABAIKAN
```
Kalau user pilih dari library (`mediaAssetId` keisi, `creativeUrl` null) → cron kirim `mediaUrl: undefined` → **ad kebuat TANPA gambar**. Jadi "pilih dari library" mustahil jalan tanpa fix backend.

🟠 **BUG TERKAIT** — `src/app/api/admin/campaign-sessions/[id]/topup/run/route.ts`:
"Run Top-Up Now" cuma **claim pool item (available→used) + queue AutomationAction PENDING**, TAPI **gak pernah manggil `createAd`** (cron yang bikin ad, dengan meng-claim item `available`). Karena run udah nge-`used`-in item itu, cron gak akan claim lagi → **creative kebakar tanpa jadi ad**. Di arsitektur independen (no worker), "Run Now" praktis rusak. Ini tombol yang dipakai user buat nge-tes → WAJIB difix barengan.

**Fakta schema (terverifikasi):**
- `MediaAsset`: punya `fileUrl` & `publicUrl` (`fileUrl` = alias publicUrl), `type` (IMAGE|VIDEO), `status` (READY|...), owner `userId`. Upload set `status='READY'`, `fileUrl=publicUrl`.
- `CampaignCreativePool.mediaAssetId` = kolom string biasa, **TANPA relation Prisma** ke MediaAsset → resolve manual via `prisma.mediaAsset.findUnique`.
- `createAd`/`uploadImageToMeta` (meta-client) = **IMAGE only** (download URL → multipart upload as image). VIDEO top-up TIDAK didukung → picker WAJIB filter `type=IMAGE`.

**Endpoint yang dipakai-ulang (terverifikasi):**
- List library: `GET /api/admin/media-assets?type=IMAGE&status=READY` → `{ assets: [{ id, fileUrl, publicUrl, label, thumbnailUrl, type, status }] }` (owner-scoped).
- Upload: `POST /api/admin/media-assets/upload` (multipart: `file` wajib + `label` opsional) → `{ asset: { id, fileUrl, publicUrl, label, status:'READY' } }`. Max 10MB image.

---

## 1. BACKEND — resolve media end-to-end (WAJIB, prioritas 1)

### 1.1 Helper baru `src/lib/creative-media.ts`
Satu sumber kebenaran buat resolve creative pool → URL gambar yang bisa diupload ke Meta.
```ts
import { prisma } from '@/lib/prisma'

export interface PoolMediaInput { mediaAssetId: string | null; creativeUrl: string | null }

/**
 * Resolve URL gambar buat createAd.
 * Prioritas: mediaAssetId (lookup MediaAsset, harus IMAGE + READY + punya URL) → fileUrl/publicUrl.
 * Fallback: creativeUrl (URL eksternal lama).
 * Return undefined kalau gak ada media valid.
 */
export async function resolvePoolMediaUrl(item: PoolMediaInput): Promise<string | undefined> {
  if (item.mediaAssetId) {
    const a = await prisma.mediaAsset.findUnique({
      where: { id: item.mediaAssetId },
      select: { fileUrl: true, publicUrl: true, type: true, status: true },
    })
    if (a && a.type === 'IMAGE' && a.status === 'READY') {
      const url = a.fileUrl ?? a.publicUrl
      if (url) return url
    }
    // mediaAssetId ada tapi invalid → JANGAN diam-diam pakai creativeUrl yang mungkin null; lanjut fallback
  }
  return item.creativeUrl ?? undefined
}
```

### 1.2 POST `creative-pool/route.ts` — validasi mediaAssetId saat simpan
Sebelum create (sesudah cek session, line ~81), kalau `body.mediaAssetId` ada:
- `findUnique` MediaAsset by id → WAJIB: `userId === auth.id` (ownership), `type === 'IMAGE'`, `status === 'READY'`, punya `fileUrl||publicUrl`.
- Gagal salah satu → `422 { error: 'Media asset tidak valid (harus gambar milik Anda yang sudah siap)' }`.
- Lolos → simpan `mediaAssetId` (creativeUrl boleh null). Aturan existing "minimal salah satu mediaAssetId|creativeUrl" (line 73) tetap.

### 1.3 Cron `topup-campaigns/route.ts` — pakai resolver
Ganti line 144 `mediaUrl: poolItem.creativeUrl ?? undefined`:
```ts
import { resolvePoolMediaUrl } from '@/lib/creative-media'
// ...
const mediaUrl = await resolvePoolMediaUrl(poolItem)
// ...createAd({ ..., mediaUrl, ... })
```
(poolItem `select` udah ambil mediaAssetId+creativeUrl — line 109, gak perlu ubah query.)

### 1.4 `topup/run/route.ts` — bikin ad BENERAN (fix orphan)
"Run Top-Up Now" harus jalanin create yang sama kaya cron, bukan cuma queue PENDING.
**Pendekatan bersih:** ekstrak logika per-session ke helper share-an dipakai cron + run, mis. `src/lib/topup-engine.ts` → `topupSession(session, token, { adAccountId, metaAdAccountId }): Promise<{created, poolEmpty}>` yang isinya = loop claim + `resolvePoolMediaUrl` + `createAd` + log + notify (pindahin dari cron). Cron & run dua-duanya panggil ini.
- Kalau ekstraksi kegedean/beresiko: minimal, di `run` GANTI blok "queue PENDING" jadi panggil `createAd` langsung (resolve token via `canWriteToAdAccount(auth.id, session.metaAdAccountId)` + `resolvePageId` + `resolvePoolMediaUrl`), persis pola cron line 128–194. Hapus pembuatan AutomationAction PENDING yang gak dikonsumsi.
- Hasil run: `{ created, activeAds, minActiveAds, action }` dengan ad NYATA kebuat PAUSED.
⚠️ Jaga: inflight guard, atomic claim (updateMany status='available'), ownership gate — JANGAN di-drop.

---

## 2. UI — TopUpTab "Tambah Creative" (prioritas 2)

File: `src/app/campaign-monitor/[id]/TopUpTab.tsx`. State `newCreative` sekarang punya `mediaUrl` (text). Form di blok "Tambah Creative".

### Ganti jadi:
- **HAPUS** input URL sebagai cara utama. Ganti dengan **media selector** 2 mode (tab/segment): **📚 Library** | **⬆️ Upload**.
- State: `selectedMediaAssetId: string|null` + `selectedMediaThumb: string|null` (buat preview).
- **Mode Library:** tombol "Pilih dari Library" → buka modal/inline grid. Fetch `GET /api/admin/media-assets?type=IMAGE&status=READY`. Tampilin thumbnail grid (pakai `fileUrl||publicUrl||thumbnailUrl`). Klik 1 → set `selectedMediaAssetId` + thumb, tutup picker. (Pola sama persis kaya picker di `GenerateVideoPage.tsx` — boleh contek, tapi versi IMAGE-only + single-select.)
- **Mode Upload:** `<input type="file" accept="image/*">` → `POST /api/admin/media-assets/upload` (FormData `file` + `label` = mis. `Topup-{sessionId}`). Sukses → `setSelectedMediaAssetId(d.asset.id)` + thumb `d.asset.fileUrl`. Tampilin progress/disable pas uploading + error inline.
- **Preview:** kalau ada `selectedMediaThumb`, tampilin thumbnail kecil + tombol "× ganti".
- **Submit "Add to Pool":** body kirim `mediaAssetId: selectedMediaAssetId` (BUKAN mediaUrl/creativeUrl). Validasi front: `primaryText` wajib + media wajib (mediaAssetId ada) → kalau belum, disable tombol + hint.
- **(Opsional, low-pri)** sisakan "Advanced: pakai URL" yang collapsed buat power user — kalau dibuka, kirim `creativeUrl`. Default ketutup. Boleh di-skip kalau nambah ribet.

### Field lain TETAP: primaryText (wajib), headline, description, callToAction, linkUrl.

---

## 3. ACCEPTANCE
1. `npx tsc --noEmit` clean · `npm run build` exit 0.
2. POST creative-pool tolak mediaAssetId yang bukan milik user / bukan IMAGE / belum READY (422).
3. `resolvePoolMediaUrl`: mediaAssetId valid → fileUrl; invalid → fallback creativeUrl; dua-duanya kosong → undefined.
4. Cron topup pakai resolver (grep line lama `creativeUrl ?? undefined` di cron HILANG).
5. `topup/run` bikin ad NYATA (bukan queue PENDING orphan) — pool item yang ke-claim dapet `usedMetaAdId`.
6. UI: form add-creative gak ada lagi input URL sebagai cara utama; ada Library picker + Upload + preview thumbnail; submit kirim mediaAssetId.
7. Inflight guard + atomic claim + ownership gate utuh (diff gak nge-drop).

---

## 4. SMOKE LIVE (WAJIB, di ai.boytenggara.com, pakai ad account test ber-billing — 1178670036856360)
Bukti tiap poin (screenshot Ads Manager / response / readback DB):
- **S1 Library path:** buka campaign detail → tab Automation → Tambah Creative → Library → pilih 1 gambar → isi primaryText/headline → Add to Pool. Cek pool item ke-create dgn `mediaAssetId` keisi (DB readback).
- **S2 Upload path:** Tambah Creative → Upload → pilih file gambar lokal → preview muncul → Add to Pool. Cek MediaAsset baru READY + pool item mediaAssetId-nya nunjuk ke situ.
- **S3 End-to-end ad:** set minActiveAds > activeAds, topupEnabled ON → "Run Top-Up Now" → **ad NYATA kebuat PAUSED di Meta dengan GAMBAR yang dipilih** (buka Ads Manager, cek creative ada image-nya, bukan blank). Catat ad_id. Bersihin (delete ad) abis verify.
- **S4 Guard:** coba Add to Pool tanpa gambar → ketolak/disabled. Coba mediaAssetId asal → 422.
- **S5 Regression:** creative lama yang pakai creativeUrl (kalau ada) masih kebuat normal (fallback resolver).
Jujur tandai mana yang live-verified vs build-only.

---

## 5. EKSEKUSI & LAPORAN (format audit murah)
- Branch `feat/topup-creative-library`. Commit per fase (helper → POST validasi → cron → run → UI → smoke).
- DILARANG: drop inflight/atomic/ownership guard; ubah API path; rename identifier.
- Jangan merge sendiri.

**LAPOR (paste mentah):**
1. `git diff --stat origin/main...HEAD`
2. `grep -n 'resolvePoolMediaUrl' src` (kepakai di cron + run?) · `grep -n 'creativeUrl ?? undefined' src` (harus 0 di cron)
3. `grep -n 'mediaUrl' src/app/campaign-monitor/[id]/TopUpTab.tsx` (input URL utama udah hilang?)
4. `npx tsc --noEmit` + `npm run build` (10 baris akhir)
5. Smoke S1–S5: PASS/FAIL + bukti (ad_id, screenshot, DB readback)
6. STATUS: DONE / PARTIAL / BLOCKED
FAIL → symptom+hipotesis+fix. Klaim PASS wajib bukti runtime (ad ber-gambar di Meta).

---

## 6. Catatan
- Resiko utama: (a) run-refactor nge-drop guard konkurensi (cegah: acceptance #7 + diff review), (b) video ke-pilih → createAd gagal (cegah: picker filter type=IMAGE), (c) URL asset gak ke-reach server pas upload ke Meta (asset pakai Railway volume publicUrl yang sama dipakai video gen — terbukti reachable).
- Self-contained: shape endpoint, field schema, line number bug semua ada di sini.
- Prioritas kalau waktu sempit: §1 (backend resolver + cron) DULU — itu yang bikin fitur beneran jalan. §2 UI kedua. §1.4 run-fix ketiga (tapi wajib buat smoke S3 manual).
```
