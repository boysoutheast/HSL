# Blueprint — Help Tooltips ("?") + Guided Tour per Fitur

**Owner:** Boy · **Author:** Fable · **Executor:** Sonnet (VPS) · **Date:** 2026-06-19
**Repo:** hermes-support-web · **Goal:** Setiap button punya penjelasan fungsi (ikon "?" kecil), dan tiap fitur (Campaign & Video Generator) punya guided tour step-by-step. Prinsip UX: **termudah & terefektif**, zero clutter.

---

## 0. Ringkasan Keputusan (JANGAN diubah tanpa alasan)

1. **Tooltip = komponen custom `HelpHint`** — zero dependency. BUKAN install react-tooltip/radix.
2. **Semua copy tooltip di 1 file** `src/lib/help-content.ts` (registry key→teks). Komponen cuma refer key.
3. **Guided tour = `driver.js`** (1 dependency ringan, vanilla, MIT, ~5kb gzip per dokumentasinya). Dibungkus hook `useTour`.
4. **Anchor tour pakai atribut `data-tour="<key>"`** di element asli. Driver.js nyari lewat selector.
5. **Persistence "udah liat" = localStorage** key `hsl_tour_<tourId>_v1`. TIDAK ada migration DB di v1.
6. **Bahasa = Indonesia informal**, sependek mungkin, jelas. Tooltip 1 kalimat. Tour step 1–2 kalimat.
7. **Mobile-first**: HelpHint tap-to-toggle, tour responsive (driver.js handle reposisi).

**Out of scope v1 (jangan dikerjain):** sinkronisasi tour-state ke server, analytics tour, tour buat halaman admin internal (Overview/Users), A/B onboarding. Catat di laporan kalau ada yang relevan.

---

## 1. Komponen `HelpHint` (tooltip "?")

**File baru:** `src/components/ui/HelpHint.tsx`

### Spec perilaku
- Render ikon "?" kecil (lingkaran, ukuran ~14px, warna stone-400, hover violet-500). Inline, sebelah label button atau section title.
- **Desktop:** muncul on hover + on focus (keyboard). **Mobile/touch:** tap toggle.
- Tutup saat: klik di luar, tekan `Escape`, blur.
- Popover: kartu kecil `max-w-[240px]`, `text-xs`, rounded, shadow, dark-mode aware (`dark:bg-stone-800`). Posisi default di atas/bawah anchor — pakai positioning sederhana (absolute relatif ke wrapper, auto-flip kalau mepet atas viewport boleh diabaikan v1, default tampil di bawah).
- A11y: `<button type="button" aria-label="Bantuan: {title}">`, popover `role="tooltip"`, `aria-describedby` opsional. Jangan submit form (type=button WAJIB — banyak button ada di dalam form).

### Props
```ts
interface HelpHintProps {
  k: keyof typeof HELP        // key ke registry help-content.ts
  side?: 'top' | 'bottom'     // default 'bottom'
  className?: string
}
```
Isi konten diambil dari `HELP[k]` → `{ title, body }`. Render `title` bold + `body` di bawahnya.

### Skeleton (Sonnet lengkapi)
```tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { HELP } from '@/lib/help-content'

export function HelpHint({ k, side = 'bottom', className = '' }: HelpHintProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const entry = HELP[k]
  if (!entry) return null   // fail-safe: key gak ada → jangan render apa-apa

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])

  return (
    <span ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={`Bantuan: ${entry.title}`}
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-stone-400 text-stone-400 text-[10px] leading-none hover:border-violet-500 hover:text-violet-500 transition"
      >?</button>
      {open && (
        <span
          role="tooltip"
          className={`absolute z-50 ${side === 'bottom' ? 'top-5' : 'bottom-5'} left-1/2 -translate-x-1/2 w-max max-w-[240px] rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-lg p-2.5 text-left`}
        >
          <span className="block text-xs font-semibold text-stone-800 dark:text-stone-100">{entry.title}</span>
          <span className="block text-[11px] text-stone-600 dark:text-stone-300 mt-0.5 leading-snug">{entry.body}</span>
        </span>
      )}
    </span>
  )
}
```

**Catatan:** `onMouseEnter/Leave` + `onClick` keduanya aktif. Di touch device, klik toggle; di desktop hover. Acceptable. Kalau hover+click flicker, prioritaskan click (boleh drop hover handlers — Sonnet pilih yang paling mulus saat smoke).

---

## 2. Registry copy — `src/lib/help-content.ts` (FILE BARU)

Semua teks tooltip di sini. **Copy di bawah ini FINAL — pakai apa adanya** (sudah disesuaikan ke fungsi asli tiap button, terverifikasi dari kode). Tambah key kalau ada button kelewat, jangan ubah makna.

```ts
export const HELP = {
  // ── Campaign Monitor (list) ──
  'cm.newLaunch':      { title: 'New Launch', body: 'Bikin campaign iklan baru dari awal lewat HSL.' },
  'cm.import':         { title: 'Import Campaign', body: 'Tarik campaign Meta yang udah ada biar bisa dikelola & diautomasi di sini.' },
  'cm.refresh':        { title: 'Refresh', body: 'Muat ulang data campaign terbaru dari server.' },
  'cm.autoToggle':     { title: 'Automation On/Off', body: 'Nyalain = HSL ngecek campaign ini berkala & jalanin rule otomatis. Mati = gak disentuh sama sekali.' },
  'cm.statusFilter':   { title: 'Filter Status', body: 'Saring campaign berdasarkan status (Running, Paused, dll).' },
  'cm.phaseFilter':    { title: 'Filter Fase', body: 'Saring berdasarkan fase: Testing, Scaling, Maintenance, Exited.' },

  // ── Campaign Detail · Overview ──
  'cd.autoToggle':     { title: 'Automation On/Off', body: 'Aktifin biar rule & top-up jalan otomatis. Butuh minimal 1 rule aktif.' },
  'cd.scanInterval':   { title: 'Interval Cek', body: 'Seberapa sering HSL ngecek campaign ini (default 5 menit). Makin kecil makin responsif, makin sering manggil Meta.' },
  'cd.structure':      { title: 'Struktur Campaign', body: 'Lihat adset & ad di dalam campaign ini langsung dari Meta.' },

  // ── Campaign Detail · Automation (rules) ──
  'cd.attachRule':     { title: 'Pasang Template Rule', body: 'Tempel aturan otomatis (mis. "scale kalau ROAS bagus", "matiin kalau boros") ke campaign ini.' },
  'cd.ruleToggle':     { title: 'Aktif/Pause Rule', body: 'Aktif = rule dievaluasi tiap scan. Pause = berhenti tanpa dihapus.' },
  'cd.ruleDetach':     { title: 'Lepas Rule', body: 'Cabut rule ini dari campaign. Gak ngehapus template aslinya.' },

  // ── Campaign Detail · Top-Up ──
  'tu.minAds':         { title: 'Minimal Ads Aktif', body: 'Batas bawah jumlah ad aktif. Kalau kurang dari ini, HSL nambah ad dari pool otomatis.' },
  'tu.enable':         { title: 'Top-Up On/Off', body: 'Nyalain auto top-up: jaga jumlah ad aktif gak turun di bawah batas.' },
  'tu.targetAdset':    { title: 'Adset Tujuan', body: 'Adset tempat ad baru dibuat saat top-up jalan.' },
  'tu.save':           { title: 'Simpan Setting', body: 'Simpan konfigurasi top-up campaign ini.' },
  'tu.runNow':         { title: 'Top-Up Sekarang', body: 'Jalanin top-up manual sekali, gak nunggu cron.' },
  'tu.addCreative':    { title: 'Tambah Creative', body: 'Siapin headline, deskripsi, primary text & media khusus campaign ini buat dipakai saat top-up.' },
  'tu.addToPool':      { title: 'Masukin ke Pool', body: 'Simpan creative ini ke pool campaign. HSL ambil dari sini pas top-up.' },

  // ── Import Campaign ──
  'im.adAccount':      { title: 'Pilih Ad Account', body: 'Akun iklan Meta sumber campaign yang mau diimpor.' },
  'im.pickCampaign':   { title: 'Pilih Campaign', body: 'Campaign Meta yang mau ditarik ke HSL.' },
  'im.confirm':        { title: 'Import & Sync', body: 'Tarik campaign + struktur adset/ad-nya ke HSL.' },

  // ── Video Generator ──
  'vg.orientation':    { title: 'Orientasi', body: 'Rasio video: 16:9, 9:16 (story/reels), 1:1, dll.' },
  'vg.resolution':     { title: 'Resolusi', body: 'SD lebih murah, HD lebih tajam (2x kredit).' },
  'vg.duration':       { title: 'Durasi', body: '6 atau 10 detik. Makin panjang makin mahal.' },
  'vg.addAsset':       { title: 'Tambah Asset', body: 'Sisipin foto akun/library/produk sebagai referensi. Maks 5.' },
  'vg.mention':        { title: 'Mention Asset', body: 'Klik chip @image buat nyebut asset di prompt, biar AI tau gambar mana.' },
  'vg.cost':           { title: 'Biaya', body: 'Estimasi kredit = durasi × resolusi. Saldo dicek sebelum generate.' },
  'vg.generate':       { title: 'Generate Video', body: 'Kirim job ke AI. Hasil muncul di History pas selesai.' },
  'vg.download':       { title: 'Download', body: 'Simpan video hasil ke perangkat.' },

  // ── Connections (relevan buat user) ──
  'cn.apiKey':         { title: 'Generate API Key', body: 'Bikin kunci buat akses endpoint /api/gen dari sistem luar.' },
  'cn.revoke':         { title: 'Cabut Key', body: 'Nonaktifin API key. Sistem yang pakai key ini langsung kehilangan akses.' },
} as const

export type HelpKey = keyof typeof HELP
```

---

## 3. Guided Tour — `driver.js`

### 3.1 Dependency
```bash
npm i driver.js
```
Import CSS-nya sekali di `src/app/layout.tsx` (atau globals): `import 'driver.js/dist/driver.css'`.

### 3.2 Hook `useTour` — `src/lib/useTour.ts` (FILE BARU)
Bungkus driver.js + persistence localStorage + auto-start sekali.

```ts
'use client'
import { driver, type DriveStep } from 'driver.js'

export interface TourDef { id: string; version: number; steps: DriveStep[] }

function seenKey(t: TourDef) { return `hsl_tour_${t.id}_v${t.version}` }

export function hasSeenTour(t: TourDef) {
  try { return localStorage.getItem(seenKey(t)) === '1' } catch { return false }
}

export function startTour(t: TourDef, opts?: { force?: boolean }) {
  if (!opts?.force && hasSeenTour(t)) return
  const d = driver({
    showProgress: true,
    nextBtnText: 'Lanjut',
    prevBtnText: 'Balik',
    doneBtnText: 'Selesai',
    steps: t.steps,
    onDestroyed: () => { try { localStorage.setItem(seenKey(t), '1') } catch {} },
  })
  // Hanya step yang anchor-nya ADA di DOM (biar gak nyangkut di element yang lagi gak ke-render)
  const valid = t.steps.filter(s => !s.element || document.querySelector(s.element as string))
  if (valid.length === 0) return
  d.setSteps(valid)
  d.drive()
}
```

**Auto-start pattern** (di tiap halaman fitur, dalam `useEffect`):
```tsx
useEffect(() => { startTour(CAMPAIGN_TOUR) }, [])   // jalan sekali kalau belum pernah liat
```

**Replay button**: tombol kecil "🧭 Tour" di header halaman → `startTour(CAMPAIGN_TOUR, { force: true })`.

### 3.3 Definisi tour — `src/lib/tours.ts` (FILE BARU)

Anchor pakai selector `[data-tour="..."]`. Sonnet WAJIB nambahin atribut `data-tour` di element yang disebut (lihat §4).

```ts
import type { TourDef } from './useTour'

export const CAMPAIGN_TOUR: TourDef = {
  id: 'campaign', version: 1,
  steps: [
    { element: '[data-tour="cm-import"]', popover: { title: 'Mulai dari sini', description: 'Import campaign Meta yang udah jalan biar bisa diatur otomatis di HSL.' } },
    { element: '[data-tour="cm-auto"]',   popover: { title: 'Saklar Automation', description: 'Ini ngidupin/matiin automasi per campaign. Mati = HSL gak nyentuh sama sekali.' } },
    { element: '[data-tour="cd-attach-rule"]', popover: { title: 'Pasang Rule', description: 'Tempel aturan: kapan budget naik, kapan ad dimatiin. Wajib minimal 1 rule aktif sebelum automation nyala.' } },
    { element: '[data-tour="cd-scan-interval"]', popover: { title: 'Interval Cek', description: 'Atur tiap berapa menit HSL ngecek campaign ini. Default 5 menit.' } },
    { element: '[data-tour="tu-enable"]', popover: { title: 'Auto Top-Up', description: 'Jaga jumlah ad aktif. Kalau turun di bawah batas, HSL nambah ad dari pool creative campaign ini.' } },
  ],
}

export const VIDEO_TOUR: TourDef = {
  id: 'video', version: 1,
  steps: [
    { element: '[data-tour="vg-format"]',   popover: { title: 'Atur Format', description: 'Pilih orientasi, resolusi, dan durasi. Ngaruh ke biaya kredit.' } },
    { element: '[data-tour="vg-add-asset"]', popover: { title: 'Tambah Referensi', description: 'Masukin foto akun/produk biar AI ngikutin visualnya. Maks 5.' } },
    { element: '[data-tour="vg-prompt"]',    popover: { title: 'Tulis Prompt', description: 'Jelasin video yang lo mau. Klik chip @image buat nyebut asset tertentu.' } },
    { element: '[data-tour="vg-cost"]',      popover: { title: 'Cek Biaya', description: 'Estimasi kredit & sisa saldo muncul di sini sebelum generate.' } },
    { element: '[data-tour="vg-generate"]',  popover: { title: 'Generate', description: 'Kirim job. Hasil muncul di History pas kelar.' } },
  ],
}
```

---

## 4. Wiring per file (ground truth dari inventory)

Untuk tiap file di bawah: (A) pasang `<HelpHint k="..." />` sebelah button, (B) tambah `data-tour="..."` di element yang jadi anchor tour, (C) untuk halaman yang punya tour: auto-start + tombol replay.

> **Aturan:** HelpHint diletakin **sebelah label**, JANGAN ganggu layout button. Untuk icon-only/toggle, taruh HelpHint di sebelah label section/kolomnya, bukan numpuk di dalam toggle.

### 4.1 `src/app/campaign-monitor/page.tsx`
- Tombol **+ Import Campaign** → bungkus/anchor `data-tour="cm-import"` + `<HelpHint k="cm.import" />`.
- Tombol **+ New Launch** → `<HelpHint k="cm.newLaunch" />`.
- **Refresh** → `<HelpHint k="cm.refresh" />`.
- Kolom/section toggle automation → `<HelpHint k="cm.autoToggle" />` di header kolom; toggle baris pertama kasih `data-tour="cm-auto"`.
- Filter Status/Phase → `<HelpHint k="cm.statusFilter" />`, `<HelpHint k="cm.phaseFilter" />`.
- **Tour:** `useEffect(() => startTour(CAMPAIGN_TOUR), [])` + tombol "🧭 Tour" di header → `startTour(CAMPAIGN_TOUR,{force:true})`.

### 4.2 `src/app/campaign-monitor/[id]/page.tsx`
- Overview: Auto toggle → `<HelpHint k="cd.autoToggle" />`. Scan interval dropdown → `data-tour="cd-scan-interval"` + `<HelpHint k="cd.scanInterval" />`. Accordion struktur → `<HelpHint k="cd.structure" />`.
- Automation tab: **+ Pasang Template** → `data-tour="cd-attach-rule"` + `<HelpHint k="cd.attachRule" />`. Toggle rule → `<HelpHint k="cd.ruleToggle" />`. **Lepas** → `<HelpHint k="cd.ruleDetach" />`.

### 4.3 `src/app/campaign-monitor/[id]/TopUpTab.tsx`
- Field min ads → `<HelpHint k="tu.minAds" />`. Toggle enable → `data-tour="tu-enable"` + `<HelpHint k="tu.enable" />`. Target adset → `<HelpHint k="tu.targetAdset" />`.
- **Save Settings** → `<HelpHint k="tu.save" />`. **Run Top-Up Now** → `<HelpHint k="tu.runNow" />`. **+ Tambah Creative** → `<HelpHint k="tu.addCreative" />`. **Add to Pool** → `<HelpHint k="tu.addToPool" />`.

### 4.4 `src/app/campaign-monitor/import/page.tsx`
- Ad account select → `<HelpHint k="im.adAccount" />`. Pick campaign → `<HelpHint k="im.pickCampaign" />`. **Import & Sync** → `<HelpHint k="im.confirm" />`.

### 4.5 `src/app/media/GenerateVideoPage.tsx`
- Group orientasi/resolusi/durasi → bungkus dalam container `data-tour="vg-format"`; HelpHint per grup: `vg.orientation`, `vg.resolution`, `vg.duration`.
- **+ Add Asset** → `data-tour="vg-add-asset"` + `<HelpHint k="vg.addAsset" />`.
- Textarea prompt → `data-tour="vg-prompt"`; chip mention area → `<HelpHint k="vg.mention" />`.
- Cost display block → `data-tour="vg-cost"` + `<HelpHint k="vg.cost" />`.
- **Generate Video →** → `data-tour="vg-generate"` + `<HelpHint k="vg.generate" />`.
- Fullscreen modal **Download** → `<HelpHint k="vg.download" />`.
- **Tour:** `useEffect(() => startTour(VIDEO_TOUR), [])` + tombol "🧭 Tour".

### 4.6 `src/app/system/ConnectionsTab.tsx` (user-facing)
- **Generate** API key → `<HelpHint k="cn.apiKey" />`. **Revoke** → `<HelpHint k="cn.revoke" />`.
- (Tab Overview & Users = admin internal, SKIP tour. Tooltip opsional, gak wajib v1.)

---

## 5. Acceptance Criteria
1. `npm run build` hijau, `tsc` clean, gak ada `any` baru yang nutupin error.
2. Tiap button di §4 punya HelpHint dgn copy SESUAI registry (gak ada key bolong → HelpHint return null, gak crash).
3. Tooltip: hover (desktop) & tap (mobile) jalan, nutup pas Esc / klik luar, gak nge-submit form.
4. Dark mode kebaca (kontras cukup).
5. Campaign tour & Video tour jalan urut, anchor nempel ke element bener, auto-start cuma sekali (localStorage), tombol replay maksa ulang.
6. Tour skip step yang elementnya gak ke-render (mis. tab belum kebuka) tanpa error.
7. driver.js CSS ke-import (tour gak tampil "telanjang").

---

## 6. Smoke Test LIVE (WAJIB — di https://ai.boytenggara.com setelah deploy)
Lapor hasil per poin dengan bukti (screenshot/console bersih):
- **S1** Buka `/campaign-monitor` first-time (incognito / clear `hsl_tour_campaign_v1`) → tour auto-jalan, 5 step, Lanjut/Balik/Selesai fungsi. Reload → tour TIDAK muncul lagi. Klik "🧭 Tour" → muncul lagi.
- **S2** Hover "?" di **Import Campaign** → muncul copy "Tarik campaign Meta…". Tap di mobile view (resize) → toggle.
- **S3** `/campaign-monitor/[id]` Automation tab → "?" di Pasang Template & Lepas tampil bener. Tour step attach-rule nempel ke tombol yg bener.
- **S4** TopUp tab → "?" di min ads / enable / save / run-now / add-to-pool semua ada & akurat.
- **S5** `/media?tab=generate` → tour video 5 step jalan; "?" di Add Asset, Generate, cost tampil. Pastikan klik "?" gak men-trigger Generate (type=button).
- **S6** Dark mode toggle → tooltip & tour kebaca.
- **S7** Build/deploy Railway sukses, gak ada error console di prod.

**Lapor format:** MAC AUDIT REPORT — tiap S1–S7: PASS/FAIL + bukti. Yang FAIL: symptom → hipotesis → fix → re-test. Jangan klaim PASS tanpa bukti runtime.

---

## 7. Catatan buat Sonnet
- Branch: `feat/help-tooltips-guided-tour`. Commit per fase (komponen → registry → tour lib → wiring per file → smoke).
- JANGAN ubah logika button apa pun. Ini murni layer bantuan (additive). Kalau nemu button yg copy-nya gak ada di registry, TAMBAH key (jangan diem-diem skip) dan lapor.
- Kalau driver.js bikin bundle/SSR error (ini client lib) → pastikan semua pemanggil `'use client'` dan import dinamis kalau perlu. Lapor kalau ketemu.
- Self-contained: blueprint ini gak refer file eksternal. Semua copy final ada di §2 & §3.3.
```
