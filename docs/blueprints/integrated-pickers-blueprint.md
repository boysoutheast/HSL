# Blueprint: Integrated Pickers — Testing Lab Campaign-Aware

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION · Tanggal: 2026-06-30
**Eksekutor:** Sonnet VPS · **Auditor final:** Fable (audit total + cross-check origin/main)
**Konteks:** Anti-pattern "field kosong minta paste ID padahal datanya udah ada di DB/integrasi". Audit Fable menemukan ini **hanya** di Testing Lab; sisanya (`test-launches/new`) sudah benar dan jadi POLA CONTOH.

---

## 0. MASALAH & POLA CONTOH

**Masalah:** Di `src/app/ads/TestingPage.tsx` (New Test drawer):
- `metaAdId` tiap varian = **input teks kosong** ("Meta Ad ID — opsional") → user disuruh paste ID manual.
- `campaignSessionId` ada di state form tapi **TIDAK ADA selector UI-nya** sama sekali.
- Padahal campaign yang sudah di-import/integrate menyimpan ads-nya sebagai `MetaEntity` (entityType='AD') dengan `metaEntityId` = Meta ad id asli + `name`. Harusnya: pilih campaign → muncul daftar ads-nya → pilih ad → `metaAdId` keisi otomatis.

**POLA CONTOH (WAJIB ditiru):** `src/app/test-launches/new/page.tsx` sudah melakukan ini dengan benar:
- fetch-on-select: pilih ad account → fetch pixels/audiences (`/api/admin/meta-tools/*`).
- creative pakai toggle **"Pilih dari Media Library" / "Input URL manual"** (lihat sekitar baris 1586) + state `mediaAssets`.
- Tiru gaya ini: dropdown dari data integrasi, dengan fallback manual.

**Data yang sudah tersedia (TIDAK perlu API baru):**
- `MetaEntity` punya `campaignSessionId` (FK langsung), `entityType` (CAMPAIGN|ADSET|AD|CREATIVE), `metaEntityId` (Meta id asli), `name`, `effectiveStatus`. (schema: model MetaEntity)
- `GET /api/admin/campaign-sessions` → `{ sessions: [...] }` (id, name, dll) — buat dropdown campaign.
- `GET /api/admin/campaign-sessions/[id]` → **sudah `include` `metaEntities`** (array berisi semua entity campaign itu). Tinggal filter `entityType === 'AD'`.

---

## 1. ATURAN GLOBAL (WAJIB)

1. Branch `main`. Sebelum mulai TIAP segmen: `git pull --rebase origin main`.
2. `npx tsc --noEmit` 0 error baru + `npm run build` sukses SEBELUM commit. (Pre-existing `driver.js` warning boleh, sebut di report.)
3. Tidak ada perubahan schema/migration di blueprint ini (murni UI wiring). Kalau merasa butuh field baru → STOP, lapor dulu.
4. Semua fetch client: `credentials: 'include'`. Tiru pola fetch + state yang sudah ada di `TestingPage.tsx` dan `test-launches/new/page.tsx`.
5. Sebelum tulis kode: baca `test-launches/new/page.tsx` bagian fetch dropdown + toggle "Pilih dari Library / Input manual" — tiru gaya itu.
6. **ANTI-FABRIKASI:** klaim commit WAJIB sertakan output asli `git rev-parse HEAD` + `git log --oneline -1`. Klaim "grep 0" sertakan command + output mentah.
7. **GUARDRAIL KREDENSIAL:** dilarang reset/ubah kredensial prod, dilarang dump secret ke disk, dilarang credential di code/log/commit. Pakai akun login yang ada untuk smoke.
8. No force-push. Tiap segmen: commit + push + SONNET REPORT (§5) + update ledger (§2).

---

## 2. SEGMENT LEDGER

| # | Segmen | Status | Commit | Catatan |
|---|--------|--------|--------|---------|
| 1 | Testing Lab: campaign selector + ad picker (metaAdId auto-fill) | DONE | e090b3b | tsc 0 + build sukses + push |
| 2 | Sweep & verify: pastikan tidak ada blank-ID input bodoh lain | DONE | — | 15 hasil grep — semua LEGIT-MANUAL. Tidak ada BUTUH-PICKER lain selain Testing Lab (sudah difix Segmen 1). |

Status: `TODO` → `DOING` → `DONE` (atau `BLOCKED: alasan`). Urut 1→2.

---

## 3. SEGMEN 1 — Testing Lab campaign-aware variant picker

**File:** `src/app/ads/TestingPage.tsx` (komponen `NewTestDrawer`).

**A. Campaign selector (Step 0 — Setup):**
- Tambah state `sessions` + fetch `GET /api/admin/campaign-sessions` saat drawer mount → `{ sessions }`.
- Tambah `<select>` "Campaign (opsional)" yang set `form.campaignSessionId`. Option: `session.name` (+ nama produk kalau ada). Option pertama: "Tanpa campaign / manual".
- Catatan: campaign opsional — test boleh dibuat tanpa campaign (varian di-sync nanti via metaAdId manual).

**B. Ambil ads dari campaign terpilih:**
- Tambah state `campaignAds: Array<{ metaEntityId: string; name: string; status?: string }>`.
- `useEffect` keyed `[form.campaignSessionId]`: kalau ada, fetch `GET /api/admin/campaign-sessions/${form.campaignSessionId}` → ambil `data.metaEntities` (atau `data.session.metaEntities` — VERIFIKASI shape dulu via baca route `[id]/route.ts`), filter `entityType === 'AD'`, map ke `{ metaEntityId, name, status: effectiveStatus }`. Kalau tidak ada campaign → `[]`.

**C. Ganti input metaAdId (Step 1 — Variants):**
- Saat ada `campaignAds.length > 0`: render **dropdown "Ad dari campaign"** per varian (option label = `ad.name` + status badge opsional, value = `ad.metaEntityId`). onChange:
  - set `variant.metaAdId = selected.metaEntityId`
  - kalau `variant.name` masih kosong → isi default `= selected.name`
- Sediakan toggle **"Pilih dari campaign" / "Input manual"** (tiru `test-launches/new` baris ~1586). Mode manual = input teks metaAdId yang lama (untuk ad yang belum tersinkron).
- Kalau tidak ada campaign terpilih → tampilkan input manual seperti sekarang (fallback), dengan hint kecil: "Pilih campaign di Setup untuk ambil ad otomatis."

**D. (Opsional, kalau mudah) type=CREATIVE:**
- Kalau campaign terpilih, boleh tawarkan juga `entityType === 'CREATIVE'` dari `metaEntities` sebagai opsi creative. Kalau ribet, SKIP + catat di report (jangan dipaksakan).

**Acceptance:**
- Drawer punya selector Campaign; pilih campaign yang punya ads → dropdown ad muncul; pilih ad → `metaAdId` keisi tanpa ketik; nama varian default keisi.
- Tanpa campaign → tetap bisa input manual (tidak regresi).
- `tsc` 0 error baru + `npm run build` sukses.
- Report sertakan: shape `metaEntities` yang dipakai (paste potongan dari route), contoh alur pilih campaign→ad.

---

## 4. SEGMEN 2 — Sweep & verify (buktikan tidak ada yang lain)

**Tujuan:** Pastikan anti-pattern ini tidak ada di form lain. Ini AUDIT, bukan bikin fitur baru — kalau nemu yang beneran bodoh, lapor dulu sebelum fix.

1. Jalankan + paste output mentah:
   `grep -rnoE 'placeholder="[^"]*([Ii][Dd]|hash|URL|url|[Pp]ixel)[^"]*"' src/app --include="*.tsx"`
2. Untuk tiap hasil, klasifikasi di report: **LEGIT-MANUAL** (kredensial Meta token/App ID/Secret, hash-checker paste, URL eksternal baru yang user memang input seperti link Shopee/WA, prompt video) **atau** **BUTUH-PICKER** (referensi ke record/entity yang sudah kita punya).
3. Cek khusus (baca + nilai): `test-launches/new` (harusnya sudah benar — pixels/audiences/creative library), `capi-configs` UI kalau ada (pixel/landing page → harusnya pilih, bukan paste), `rules-editor/builder` (referensi campaign/entity).
4. **Ekspektasi (dari audit Fable):** hanya Testing Lab yang bermasalah; sisanya sudah pakai picker. Kalau temuan sesuai ekspektasi → report "tidak ada BUTUH-PICKER lain selain yang sudah difix Segmen 1". Kalau nemu yang baru → **JANGAN auto-fix**, list di report dengan file:line + sumber data yang seharusnya, biar Fable putuskan.

**Acceptance:** report berisi tabel klasifikasi semua hasil grep (LEGIT-MANUAL vs BUTUH-PICKER) dengan output grep mentah. Tidak ada perubahan kode di segmen ini kecuali ada temuan yang disetujui.

---

## 5. SONNET REPORT (format wajib tiap segmen)

```
## SONNET REPORT — Segmen N: [judul]
Commit: <git rev-parse HEAD>          ← output asli
git log -1: <git log --oneline -1>    ← output asli

### Yang dikerjakan
- file + 1 baris

### Acceptance (bukti)
- tsc: <tail npx tsc --noEmit>
- build: <tail npm run build — "Compiled successfully" + pages>
- shape/endpoint yang dipakai (paste potongan), contoh alur

### MAC Audit (self)
1. Objective vs hasil — kejawab? gap?
2. Side-effect / regresi (input manual masih jalan?)
3. Asumsi belum kebukti?

### Ledger: Segmen N → DONE (tabel §2 updated + commit)
### Next: Segmen N+1
```

Setelah 2 segmen DONE → kirim ringkasan + semua commit. Fable audit total (cross-check origin/main + smoke live). JANGAN klaim FULL DONE tanpa 2 ledger DONE + 2 SONNET REPORT dengan commit asli.

## 6. DEFINITION OF DONE
- Testing Lab: pilih campaign → ad picker → metaAdId auto-fill; fallback manual tetap jalan.
- `tsc` 0 error baru; `npm run build` sukses.
- Segmen 2 report membuktikan tidak ada anti-pattern lain (atau list temuan untuk keputusan Fable).
- Tidak ada perubahan schema; tidak ada kredensial di code/log/commit.
