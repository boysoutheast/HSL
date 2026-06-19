# Blueprint — Rebrand HSL / "Hermes Support Library" → **AI Buddy**

**Owner:** Boy · **Author:** Fable · **Executor:** Sonnet (VPS) · **Date:** 2026-06-19
**Repo:** hermes-support-web · **Goal:** Ganti SEMUA brand/label user-facing dari "HSL"/"Hermes Support Library"/"Hermes agent/worker" jadi **"AI Buddy"** (agent → "AI Buddy agent"). Pasang logo AB baru. **JANGAN** sentuh server/infra (API path, repo, Railway, DB, env, code identifier).

---

## 0. ATURAN SCOPE (paling penting — salah klasifikasi = breaking)

### ✅ RENAME — hanya STRING yang DIRENDER ke user
Yaitu: JSX text node, dan value dari prop yang ditampilkan: `title=`, `purpose=`, `placeholder=`, `label=`, `desc=`, `empty=`, `inputs={[...]}`, heading `<h1>/<h2>/<h3>`, metadata `title`/`description`, copy tooltip/tour/help, prosa docs, brand sidebar/login/register.

Mapping:
| Dari | Jadi |
|---|---|
| `HSL` | `AI Buddy` |
| `Hermes Support Library` / `Hermes Support` | `AI Buddy` |
| `Hermes Worker` (label tampil) | `AI Buddy worker` |
| `Hermes Agent` / `Hermes agent` / `Hermes Agents` (label tampil) | `AI Buddy agent` / `AI Buddy agents` |
| bare `Hermes` di prosa tampil (mis. "dibaca Hermes", "diproses Hermes") | `AI Buddy` |
| `dashboard Hermes` | `dashboard AI Buddy` |

### 🚫 KEEP — JANGAN diubah (server/infra/code)
1. **API path literal**: `/api/hermes/*`, `/api/worker/*`, `/api/internal/*` — termasuk yang DITAMPILKAN di docs sebagai path endpoint (itu URL beneran, ganti = rusak integrasi). Prosa di sekitarnya boleh diganti, path-nya TIDAK.
2. **Code identifier**: `interface HermesAgent`, `useState hermesAgents`, `handleHermesCreate/Regen/Toggle/Copy`, `hermesAgentName`, `createdByHermesId`, `createdByHermesAgentId`, dll. Variabel/fungsi/tipe/field — JANGAN rename (bukan user-facing, beresiko).
3. **DB**: nama tabel/kolom (`hermes_agents`, `is_worker`, `created_by_hermes_id`), model Prisma `HermesAgent`.
4. **Env var**: `HERMES_*`, `HSL_AUTOMATION_WRITES_ENABLED`, dll.
5. **Repo** `hermes-support-web`, **Railway service** (`hermes-support-web`, cron-*), hostname/server.
6. **Header network** `User-Agent: 'HSL/1.0'` (video-rehost.ts) — KEEP (identitas teknis, bukan user-facing).
7. **Komentar kode** internal (mis. `// HSL Credit Engine v3`, `// Semua call HSL-side`) — opsional, boleh diganti kalau gampang, TAPI bukan prioritas & jangan sampe ganggu kode. Skip kalau ragu.

**Prinsip:** kalau string itu MUNCUL di layar user → rename. Kalau cuma dibaca mesin/dev (path, var, env, kolom DB) → keep. Ragu → keep + catat di laporan.

---

## 1. LOGO & IDENTITAS VISUAL

Saat ini `public/` kosong (cuma .gitkeep), belum ada logo/favicon. Logo baru = monogram **"AB"** + wordmark **"AI Buddy"** (lihat referensi gambar dari Boy: bar miring "A" + titik + "B", monokrom hitam di background putih).

### 1.1 Komponen `src/components/Logo.tsx` (BARU)
Bikin komponen reusable. Mark = inline SVG (biar tajam di semua ukuran + ikut warna via `currentColor` buat dark mode). Wordmark opsional via prop.

```tsx
export function LogoMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* A — bar miring */}
      <path d="M30 6 L18 58 L9 58 L21 6 Z" />
      {/* titik */}
      <circle cx="27.5" cy="51" r="5" />
      {/* B — stem + 2 lobe */}
      <path d="M35 6 h9 a13 13 0 0 1 0 26 a13 13 0 0 1 0 26 h-9 Z" />
    </svg>
  )
}

export function Logo({ wordmark = true, className = '' }: { wordmark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      {wordmark && <span className="font-bold tracking-tight">AI Buddy</span>}
    </span>
  )
}
```
> ⚠️ SVG di atas APPROKSIMASI mark "AB". Kalau Boy kasih file logo final, simpan ke `public/logo.png` dan boleh dipakai via `<img>` sebagai gantinya. Jangan ngaku "logo persis" kalau masih pakai approx — sebut di laporan.

### 1.2 Favicon / app icon
Tambah `src/app/icon.svg` (Next.js App Router auto-pakai sebagai favicon). Isi = `LogoMark` versi standalone (viewBox 0 0 64 64, `fill="#111"` hardcode karena favicon gak ikut theme). Hapus referensi favicon lama kalau ada.

### 1.3 Wiring brand (ganti yang lama)
- **`src/components/Sidebar.tsx` (≈baris 76–83):** ganti kotak violet + ikon petir + teks "Hermes"/"Support Library" → `<LogoMark className="w-7 h-7 text-violet-600" />` + `<p>AI Buddy</p>` (boleh drop sub-teks, atau sub-teks kecil "Ads Automation"). Jaga layout 56px header.
- **`src/app/login/page.tsx` (≈baris 55–59):** ganti kotak violet + emoji ⚡ + "Hermes Support" → `<LogoMark>` (di tile) + `<h1>AI Buddy</h1>`, sub "Admin Dashboard" boleh tetap.
- **`src/app/register/page.tsx` (baris 50):** "Hermes Support Library" → "AI Buddy".
- **`src/app/layout.tsx` (baris 8–9):** `title: 'AI Buddy'`, `description: 'Dashboard otomasi Meta Ads & generate konten — AI Buddy'` (buang frasa "Hermes AI agents", ganti "AI Buddy agent").

---

## 2. INVENTORY USER-FACING TERKONFIRMASI (ganti semua)

Sudah di-grep Fable. Minimal list ini WAJIB keganti (selain hasil grep exhaustive §3):

**Brand inti:**
- `src/app/layout.tsx:8-9` metadata
- `src/components/Sidebar.tsx:81-82`
- `src/app/login/page.tsx:58`
- `src/app/register/page.tsx:50`

**"HSL" di copy:**
- `src/app/campaign-monitor/import/page.tsx:143,235`
- `src/app/campaign-monitor/page.tsx:231`
- `src/app/docs/page.tsx:78,102,199,494,564` (heading "HSL API — Dokumentasi" → "AI Buddy API — Dokumentasi"; "Cara Konek Agent ke HSL" → "...ke AI Buddy"; dst)
- `src/app/system/ConnectionsTab.tsx:419,424` ("HSL job ID" → "AI Buddy job ID")
- `src/lib/tours.ts:6,7,9,10` (HSL → AI Buddy)
- `src/lib/help-content.ts:3,6,12,21,27,31,32` (HSL → AI Buddy)

**"Hermes" label/prosa tampil → AI Buddy / AI Buddy agent/worker:**
- `src/app/system/ConnectionsTab.tsx:37(comment opsional),190(comment),193` → heading "🤖 Hermes Agent Keys" jadi "🤖 AI Buddy Agent Keys". (Tapi `interface HermesAgent`, semua `hermes*` state/handler = KEEP.)
- `src/app/agents/page.tsx:297,304,305,318,452` ("Hermes Agents" → "AI Buddy Agents", "Add Hermes Agent" → "Add AI Buddy Agent", placeholder "Hermes 1" → "Agent 1", dst)
- `src/app/test-launches/[id]/page.tsx:302` ("Hermes Worker" → "AI Buddy worker")
- `src/app/monitor/page.tsx:125,133,183` ("Assigned Hermes" → "Assigned Agent" / "AI Buddy", prosa Hermes → AI Buddy)
- `src/app/products/[id]/page.tsx:195,196,340,551,578,807` + `:810` ("→ Hermes /library" = label desc, path-nya KEEP tapi kata "Hermes" boleh jadi "AI Buddy"; hati-hati `/library` tetap)
- `src/app/products/page.tsx:193,197`
- `src/app/ceps/page.tsx:110,119,128,129` (prosa; `createdByHermesId` field KEEP)
- `src/app/media-rules/page.tsx:137,146`
- `src/app/admin-users/page.tsx:93` ("dashboard Hermes" → "dashboard AI Buddy")
- `src/app/logs/page.tsx:156,191,254` ("Hermes" kolom & prosa → "AI Buddy")
- `src/app/accounts/[id]/characters/[charId]/page.tsx:379,709`

**Komentar/non-UI (opsional, low-pri, skip kalau ragu):** `src/lib/credits.ts:2`, `src/lib/meta-graph.ts:2`, `src/lib/video-rehost.ts:38` (UA — KEEP).

---

## 3. PASS EXHAUSTIVE (grep-driven, biar gak ada yang kelewat)

Setelah ganti list §2, jalanin grep ini dan klasifikasi tiap hit (rename kalau user-facing, keep kalau code/path):
```
grep -rn '\bHSL\b' src
grep -rn 'Hermes' src --include='*.tsx' | grep -v '/api/'
grep -rn 'Hermes Support' src
```
Target akhir: **0 "HSL" user-facing** & **0 "Hermes" di string tampil**. Yang boleh sisa: code identifier (`HermesAgent`, `hermes*`, `createdByHermesId`), path `/api/hermes`, env, komentar.

---

## 4. ACCEPTANCE
1. `npx tsc --noEmit` clean · `npm run build` exit 0.
2. Sidebar, login, register, browser tab title = "AI Buddy" + logo AB tampil (bukan petir/emoji lama).
3. `grep -rn '\bHSL\b' src` → sisa hanya komentar/UA (sebut di laporan), 0 di JSX/metadata/copy.
4. `grep -rn 'Hermes' src --include='*.tsx' | grep -v '/api/'` → sisa HANYA code identifier (`HermesAgent`, `hermes...`), 0 di text tampil.
5. **API path `/api/hermes/*` utuh** — `grep -rn '/api/hermes' src | wc -l` SEBELUM = SESUDAH (buktiin gak keganti).
6. Tidak ada rename code identifier/DB/env (diff gak nyentuh nama variabel/fungsi/model).
7. Dark mode: logo kebaca (pakai currentColor / kontras cukup).

---

## 5. SMOKE LIVE (setelah deploy)
- **S1** Buka `/login` → judul "AI Buddy" + logo AB (bukan ⚡). Screenshot.
- **S2** Login → sidebar brand "AI Buddy" + logo. Tab browser title "AI Buddy". Screenshot.
- **S3** `/system` Connections → section "🤖 AI Buddy Agent Keys"; bikin agent masih JALAN (fungsi gak rusak — `hermes*` handler utuh). 
- **S4** `/docs` → heading "AI Buddy API", tapi path endpoint tetap `/api/hermes/...` (cek 1 contoh).
- **S5** `/campaign-monitor` + `/media` → gak ada lagi tulisan "HSL"/"Hermes" di copy yang kebaca user.
- **S6** Favicon tab = mark AB.
Bukti: screenshot tiap S + console bersih.

---

## 6. EKSEKUSI & LAPORAN (format biar Fable audit murah)
- Branch: `feat/rebrand-ai-buddy`. Commit per fase (logo → brand inti → copy HSL → copy Hermes → grep-pass → build). Jangan merge sendiri.
- DILARANG rename: API path, code identifier, DB, env, repo, railway. Kalau diff nyentuh itu → STOP, salah.

**LAPOR (paste mentah):**
1. `git diff --stat origin/main...HEAD`
2. `grep -rn '\bHSL\b' src` → sisa (klasifikasi tiap baris: keep/why)
3. `grep -rn 'Hermes' src --include='*.tsx' | grep -v '/api/'` → sisa (harus code identifier semua)
4. `grep -rcn '/api/hermes' src` sebelum vs sesudah (harus SAMA)
5. `npx tsc --noEmit` + `npm run build` (10 baris akhir)
6. Logo: pakai SVG approx atau file final Boy? (jujur)
7. Smoke S1–S6: PASS/FAIL + screenshot path
8. STATUS: DONE / PARTIAL / BLOCKED

Jujur. Klaim PASS wajib bukti. FAIL → symptom+hipotesis+fix.

---

## 7. Catatan
- Ini additive/cosmetic — gak ngubah logika. Resiko utama = (a) keganti code identifier/path (breaking), (b) ada copy kelewat. Dua-duanya dicegah grep-pass §3 + acceptance §4–5.
- Self-contained: semua mapping ada di sini. Logo SVG ada di §1.1.
```
