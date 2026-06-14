# Blueprint: Studio Generate V2

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION
**File target:** `src/app/media/GenerateVideoPage.tsx` (full rewrite)
**Estimasi:** 30–40 menit Sonnet
**Deps:** `/api/admin/photos`, `/api/admin/products`, `/api/admin/accounts`, `/api/admin/connections/credits`, `/api/admin/generate/video`

---

## Tujuan

Satu halaman generate video yang clean — prompt + referensi + settings + generate. Tidak ada sub-tabs, tidak ada flow berlapis.

---

## Layout (atas ke bawah)

```
┌─────────────────────────────────────────────────────┐
│ PROMPT                                              │
│ ┌─────────────────────────────────────────────────┐ │
│ │ textarea — user ketik, bisa mention @image1     │ │
│ │ @image1 dipakai sebagai referensi video ini     │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Referenced in prompt:  [@image1 chip] [@image2 chip]│
│                                                     │
│ [+ Add Asset]   ← buka asset picker modal          │
│                                                     │
├─────────────────────────────────────────────────────┤
│ ORIENTATION                                         │
│ [16:9] [9:16*] [1:1] [2:3] [3:2]                  │
│ (* default Portrait untuk IG Reels)                 │
├─────────────────────────────────────────────────────┤
│ DURATION                                            │
│ [6 detik*] [10 detik]                              │
├─────────────────────────────────────────────────────┤
│ SALDO & BIAYA                                       │
│ Saldo: X credits · Generate ini: Y credits         │
│ Setelah generate: Z credits                        │
│ ⚠️  warning kalau Z < 0                            │
├─────────────────────────────────────────────────────┤
│                          [Generate Video →]        │
└─────────────────────────────────────────────────────┘

─── Riwayat (bawah) ───────────────────────────────────
[job cards: status badge · prompt · refs · download]
```

---

## Asset Picker (modal, fullscreen mobile)

Buka via tombol `+ Add Asset`. Satu modal dengan 3 tab internal:

| Tab | Source API | Yang ditampilkan |
|---|---|---|
| **Akun** | `GET /api/admin/accounts` | chips @username dengan avatar |
| **Library** | `GET /api/admin/photos?status=active` | grid foto 64px |
| **Produk** | `GET /api/admin/products` | list nama produk |

Saat user pilih satu asset → modal tutup → asset masuk ke `assets[]` array.
Setiap asset dapat slot @image1, @image2, ... (index = posisi di array).
Klik chip asset di bawah prompt → insert `@imageN` di posisi cursor textarea.
Klik ✕ di chip → hapus dari array (re-index sisanya).

Max 5 assets. Kalau sudah 5, tombol + Add Asset disabled.

---

## State Model

```ts
interface Asset {
  id: string
  type: 'photo' | 'product' | 'account'
  label: string      // "@username" / foto label / nama produk
  thumbnailUrl?: string
  sourceId: string   // photoReferenceId / productId / igAccountId
}

// State
assets: Asset[]                    // max 5, urutan = @image1..5
prompt: string
orientation: '16:9'|'9:16'|'1:1'|'2:3'|'3:2'  // default '9:16'
duration: 6 | 10                   // default 6
creditBalance: number              // dari API
showPicker: boolean
pickerTab: 'account' | 'library' | 'product'
```

---

## Orientation options

```ts
const ORIENTATIONS = [
  { id: '16:9', label: 'Landscape', sub: '16:9' },
  { id: '9:16', label: 'Portrait',  sub: '9:16' },   // default
  { id: '1:1',  label: 'Square',    sub: '1:1'  },
  { id: '2:3',  label: 'Vertical',  sub: '2:3'  },
  { id: '3:2',  label: 'Horizontal',sub: '3:2'  },
]
```

Tampilkan sebagai kartu kecil (kotak gambar placeholder + label + sub). Selected = border violet.

---

## Credit display

Cost formula (sama dengan backend `getGenerationCost`):
```ts
const baseCost = duration === 6 ? 1000 : 1300
const cost = resolution === 'HD' ? baseCost * 2 : baseCost
// resolution: untuk sementara selalu 'SD' (HD di-hide, bisa ditambahin nanti)
```

Display:
```
Saldo: 2.000 credits · Generate ini: 1.000 credits · Sisa: 1.000 credits
```
Kalau saldo < cost → teks merah + button disabled + "Saldo tidak cukup".

Load credit: `GET /api/admin/connections/credits` → `data.creditBalance`.

---

## @mention system

- Textarea biasa (tidak perlu rich-text editor)
- Tombol chip di bawah textarea: satu chip per asset (`@image1`, `@image2`, ...)
- Klik chip → insert teks `@imageN` di posisi cursor (via `setSelectionRange` + `document.execCommand` atau manual state)
- "Referenced in prompt" section: parse prompt untuk `@image\d+` → highlight chips yang aktif di-mention
- Tidak perlu autocomplete dropdown — chip klik cukup

---

## Submit payload

```ts
POST /api/admin/generate/video
{
  prompt: string,                       // dengan @imageN mentions
  instagramAccountId?: string,          // dari asset type='account' (pertama)
  photoReferenceIds: string[],          // dari asset type='photo' + type='product' (urutan index)
  orientation: string,                  // '9:16' dll
  durationSeconds: number,              // 6 | 10
}
```

Catatan: `photoReferenceIds` di backend sudah wired. `orientation` + `durationSeconds` sudah diterima backend (`src/app/api/admin/generate/video/route.ts`) — tinggal pastikan dikirim.

---

## Riwayat (bawah halaman)

Grid cards sederhana:
- Thumbnail (ref pertama atau video frame)
- Status badge (Antrian / Proses / Rehosting / Selesai / Gagal)
- Prompt singkat (line-clamp-1)
- Tanggal
- Kalau completed: button Download + video preview inline (klik expand)
- Polling 12s kalau ada job aktif

---

## Error states

- Submit tanpa prompt → inline error "Prompt wajib diisi"
- Submit saldo kurang → button disabled sebelum klik (tidak bisa submit)
- Fetch gagal → silent (jangan crash halaman)
- Asset picker load error → "Gagal memuat, coba lagi" + retry button

---

## Aturan wajib

- Semua fetch pakai `credentials: 'include'`
- Tidak ada `import` server-only (Prisma, auth) — ini pure client component
- Tidak ada polling yang jalan terus kalau tidak ada active jobs
- `setInterval` selalu dibersihkan di `useEffect` cleanup
- tsc --noEmit 0 error dari file ini (pre-existing error di file lain boleh)
- No force-push ke main. Commit setelah selesai + verified.
- JANGAN claim done sebelum: (1) tsc clean file ini, (2) visual check endpoint `/api/admin/generate/video` dapat payload bener

---

## Execution Order

```
1. Baca file existing: src/app/media/GenerateVideoPage.tsx
2. Baca: src/app/api/admin/generate/video/route.ts (pastikan orientation + durationSeconds diterima)
3. Baca: src/app/api/admin/connections/credits/route.ts (pastikan creditBalance ada)
4. Tulis GenerateVideoPage.tsx baru (full rewrite sesuai blueprint)
5. tsc --noEmit — fix error di file ini
6. git add + commit + push
7. Lapor: payload yang akan dikirim ke API (contoh JSON), credit display logic, error states
```
