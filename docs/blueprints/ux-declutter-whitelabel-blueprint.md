# Blueprint — Declutter UX Advertiser + Scrub White-Label (GeminiGen)

**Owner:** Boy · **Author:** Fable · **Executor:** Sonnet (VPS) · **Date:** 2026-06-19
**Repo:** hermes-support-web · **Goal:** Halaman yang dipakai orang awam setup ads jadi **enak & gak ngebingungin** — buang sampah developer dari view advertiser, dan **HAPUS semua jejak "GeminiGen"** dari UI (white-label).

---

## 0. SCOPE & CONSTRAINT KERAS

### 🚫 CONSTRAINT MUTLAK — GeminiGen DILARANG muncul di UI
Produk ini white-label. Nama penyedia video **"GeminiGen" TIDAK BOLEH** keliatan user di mana pun (teks, tabel, contoh, URL webhook).
- **Scrub:** semua STRING "GeminiGen" yang dirender ke user → ganti generik ("sistem", "diproses", "antrian").
- **KEEP (infra, bukan UI):** endpoint backend `/api/webhooks/geminigen`, env `GEMINIGEN_*`, route handler, kode integrasi — itu mesin, JANGAN disentuh. Yang dihapus cuma yang KELIATAN user.

### Prinsip: pisahin 2 audiens
ConnectionsTab sekarang dilihat SEMUA user (advertiser awam + developer integrasi). Advertiser cuma butuh: **Hubungkan Meta + Saldo + Harga**. Sisanya (API key, endpoint, flow, error code) = developer-only → sembunyiin, jangan dihapus fungsinya.

---

## 1. 🚨 SCRUB GEMINIGEN (prioritas 1 — wajib)

File: `src/app/system/ConnectionsTab.tsx`. Ganti string berikut (line approx):
| Line | Sekarang | Jadi |
|---|---|---|
| 514 | `...tergantung antrian GeminiGen` | `...tergantung antrian sistem` |
| 526 | `Submit → GeminiGen webhook masuk → langsung completed` | `Submit → diproses → langsung selesai` |
| 530 | `Submit → GeminiGen lambat → job stalled...` | `Submit → sistem lambat → job stalled...` |
| 547 | `Di GeminiGen` | `Sedang diproses` |
| 549 | `GeminiGen gagal (status=3)` | `Pemrosesan gagal` |
| 550 | `Melebihi 30 menit, masih proses di GeminiGen` | `Melebihi 30 menit, masih diproses` |
| 560 | `...video mungkin masih jadi di GeminiGen` | `...video mungkin masih diproses` |
| 570 | `Refund otomatis saat: GeminiGen failed (status=3) ATAU job never submitted` | `Refund otomatis saat: pemrosesan gagal ATAU job tidak terkirim` |
| 576–580 | Blok "Webhook" + URL `https://ai.boytenggara.com/api/webhooks/geminigen` | **HAPUS seluruh sub-blok webhook** (internal infra, gak perlu user tau) |

Juga buang `status=3` (kode internal) di mana pun keliatan user.

**Acceptance scrub:** `grep -rin 'geminigen' src/app src/components` (exclude `/api/` & `route.ts`) = **0**.

> Sekalian cek `src/app/docs/page.tsx` & file UI lain — kalau ada "GeminiGen"/"grok"/provider name, scrub juga. (Audit Fable: cuma ConnectionsTab yang bocor, tapi verifikasi ulang.)

---

## 2. DECLUTTER ConnectionsTab — sembunyiin dev stuff (prioritas 2)

Tujuan: advertiser buka `/system?tab=connections` cuma lihat hal yang dia ngerti.

### 2.1 TETAP tampil (user-facing, urutan ini):
1. **🔗 Meta Connections** (line ~270) — koneksi + tombol Hubungkan Meta (udah bagus, jangan diubah).
2. **💳 Credit Balance** (line ~336) — saldo + transaksi.
3. **💰 Harga** (Pricing, line ~620) — biaya video (SD/HD). Pertahankan, tapi pastiin bahasa awam (lihat §2.3).

### 2.2 PINDAH ke satu disclosure collapse "🧩 Developer / API (opsional)" — default TERTUTUP, di paling bawah:
Bungkus SEMUA ini dalam `<details>` (atau state toggle) yang default closed, supaya gak makan layar advertiser:
- 🤖 AI Buddy Agent Keys (line ~190)
- 🔑 Generate API Key (line ~380)
- Active Keys (line ~400)
- 📡 API Gen Endpoints (line ~434)
- ⏱ Flow & Timing (line ~510)
- 🔄 Refund Policy (line ~568, SUDAH di-scrub §1)
- ⚠️ Error Codes (line ~586)
- 🚀 Generate Example / 🔄 Polling Example (line ~598)

Header disclosure: `🧩 Developer / API (opsional)` + subteks kecil: "Buat yang mau integrasi sistem sendiri. Kalau cuma jalanin iklan, abaikan bagian ini."

> **JANGAN hapus fungsinya** — generate/revoke API key tetap jalan, cuma ke-collapse. Fungsi handler (`handleGenerate`, `handleHermesCreate`, dll) utuh.

### 2.3 Bersihin jargon di bagian yang TETAP tampil
- "credits" tetap, tapi di Pricing tambah 1 baris awam: "Credits = saldo buat generate video. Top up via admin." (gak usah mapping kurs kalau belum ada).
- Buang istilah teknis yang nyasar di luar disclosure (clientRef, polling, webhook, endpoint, Bearer token) — semua itu sekarang ada DI DALAM disclosure §2.2, jadi otomatis kelar.

---

## 3. HASIL YANG DIHARAPKAN
Advertiser buka Connections → lihat: **Hubungkan Meta · Saldo · Harga** + 1 baris "🧩 Developer / API (opsional)" yang ketutup. Bersih, gak intimidatif. Developer yang butuh tinggal expand. Nol "GeminiGen".

---

## 4. ACCEPTANCE
1. `npx tsc --noEmit` clean · `npm run build` exit 0.
2. `grep -rin 'geminigen' src/app src/components | grep -v '/api/' | grep -vi 'route.ts'` = **0**.
3. ConnectionsTab default (collapse tertutup) cuma render: Meta Connections, Credit Balance, Harga.
4. Disclosure "Developer / API" expand → semua section dev muncul, generate/revoke API key MASIH JALAN.
5. Gak ada fungsi yang ke-drop (handler API key/agent utuh). Backend `/api/webhooks/geminigen` & env GEMINIGEN_* TIDAK disentuh.
6. Webhook URL & `status=3` gak keliatan user lagi.

---

## 5. SMOKE LIVE (setelah deploy)
- **S1** `/system?tab=connections` (login user biasa) → cuma 3 blok user-facing + 1 disclosure tertutup. Screenshot.
- **S2** Expand "🧩 Developer / API" → section dev muncul; klik Generate API Key → key kebuat (fungsi jalan). Screenshot.
- **S3** Search teks "GeminiGen" di halaman (Ctrl+F / view-source) → **0 hasil**. Screenshot/console.
- **S4** Generate video tetap jalan normal (regression — webhook backend gak kesentuh).
Jujur tandai visual vs build-only.

---

## 6. EKSEKUSI & LAPORAN
- Branch `feat/ux-declutter-whitelabel`. Commit per fase (scrub → collapse → jargon). Jangan merge sendiri.
- DILARANG: hapus fungsi API key/agent; sentuh backend webhook/route/env GeminiGen; ubah Meta Connections section.

**LAPOR (paste mentah):**
1. `git diff --stat origin/main...HEAD`
2. `grep -rin 'geminigen' src/app src/components | grep -v '/api/' | grep -vi 'route.ts'` → harus 0
3. `grep -n 'API Gen Endpoints\|Flow & Timing\|Developer / API' src/app/system/ConnectionsTab.tsx` (buktiin ke-collapse, bukan ke-hapus)
4. `npx tsc --noEmit` + `npm run build`
5. Smoke S1–S4 + screenshot
6. STATUS

---

## 7. ⚠️ CLEANUP WAJIB SETELAH DEPLOY (instruksi Boy)
Setelah blueprint ini ke-deploy SUKSES, **HAPUS file blueprint md yang udah kelar** dari `docs/blueprints/` biar gak numpuk:
- `docs/blueprints/ux-declutter-whitelabel-blueprint.md` (ini)
- Plus blueprint lain yang FITURNYA UDAH DI MAIN & DEPLOYED: `help-tooltips-and-guided-tour-blueprint.md`, `rebrand-ai-buddy-blueprint.md`, `topup-creative-from-library-blueprint.md`, `meta-connection-entrypoint-fix-blueprint.md`.
Commit terpisah: `chore: cleanup deployed blueprints`. (Aturan baru: blueprint = sekali pakai, hapus abis deploy.)

---

## 8. OUT OF SCOPE (rekomendasi UX besar — JANGAN dikerjain sekarang, lapor aja)
Audit nemu friksi lebih dalam buat orang awam — bukan bagian pass ini, butuh keputusan Boy dulu:
- Onboarding "3 langkah" first-login (Connect Meta → Import campaign → Pasang rule).
- Penjelasan "apa itu Rule" di tab Automation (IF kondisi THEN aksi).
- Tooltip glossary: CPC, ROAS, fase TESTING/SCALING, "Scan interval".
- Activity log: render JSON mentah jadi kalimat ("Budget naik ke Rp50.000").
- Rename page "System" → "Pengaturan".
Ini di-list biar gak lupa; kerjain terpisah kalau Boy mau.
```
