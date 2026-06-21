# Blueprint B — Design-System Pass Se-App (UI/UX 6/10 → enak)

**Owner:** Boy · **Author:** Fable · **Executor:** Sonnet (VPS) · **Date:** 2026-06-21
**Repo:** hermes-support-web · **Goal:** Rambat token desain + hierarki dari Pilot A (`9211802`) ke SELURUH halaman — biar gak "plain, gak tau mana button, gak ada focal point". Konsisten, enak dipakai.

> **Kerjain SETELAH Blueprint C** (C nambah tombol/komponen; B nge-style termasuk yang baru). Token udah ada di `globals.css` (dari Pilot A) — JANGAN bikin sistem baru, PAKAI yang ada + konsistenin.

---

## 0. TOKEN ACUAN (sudah ada dari Pilot A — dipakai-ulang)
- `.btn-primary` (violet, aksi UTAMA, **maks 1/section** = focal point) · `.btn-secondary` (outline netral) · `.btn-ghost` (tersier/nav) · `.btn-danger` (destruktif) · `.btn-success` (konfirmasi positif).
- Badge status semantik: connected/aktif=emerald, expired/warning=amber, error/reconnect=red, inactive=stone.
- `.input-field`, focus ring violet, `.card`.

---

## 1. PRINSIP (terapin ke tiap halaman)
1. **Satu focal CTA per halaman** — aksi utama pakai `.btn-primary`, menonjol (kanan-atas header / posisi keputusan). Aksi lain di-kalem-in (secondary/ghost). JANGAN banyak primary sejajar.
2. **Hierarki visual** — judul halaman (`.page-title`) jelas, section (`.section-title`), aksi minor kecil/ghost. Mata tau urutan baca.
3. **Warna purposeful** — status & hasil pakai warna semantik (bukan violet/stone semua). Sukses=hijau, bahaya=merah, perhatian=amber, netral=stone. Violet = aksen aksi.
4. **Napas & kontras** — kurangi "flat abu": spacing cukup, card punya sedikit beda weight di area aksi, divider tipis.
5. **Konsistensi komponen** — semua tombol pakai `.btn-*` (BUKAN raw `<button className="...">` ad-hoc). Audit & ganti raw button.

---

## 2. CAKUPAN HALAMAN (urut prioritas trafik)
Terapkan prinsip §1 ke:
1. **Dashboard** (`/`) — focal: antrian keputusan. Perjelas angka/CTA.
2. **Campaign Monitor** (`/campaign-monitor` + `[id]` detail + import) — focal: Import/primary action; status campaign warna semantik; tab jelas.
3. **Studio/Media** (`/media`) — focal: Generate. (UX di sini udah paling bagus — konsistenin aja.)
4. **Accounts** (`/influencer` / accounts) — list + aksi.
5. **System** (Overview/Users/Connections) — Connections udah di-polish Pilot A; samain Overview & Users.
6. **Sisanya** (products, characters, ceps, test-launches, media-rules, dll) — minimal: 1 focal CTA + button pakai `.btn-*` + status semantik.

Per halaman, fokus 3 hal: **(a) focal CTA jelas, (b) button hierarchy konsisten, (c) status/hasil warna semantik.** JANGAN ubah logika/handler — murni presentational.

---

## 3. AUDIT ANTI-INKONSISTENSI (sebelum klaim selesai)
- `grep -rn 'className="[^"]*\bbg-violet-600\b' src/app` & raw `<button` tanpa `.btn-` → temuin tombol ad-hoc, ganti ke token.
- Pastiin gak ada halaman dgn >1 `.btn-primary` dalam satu section.
- Pastiin status (badge/pill) pakai kelas semantik, bukan hardcode violet/stone di mana-mana.

---

## 4. ACCEPTANCE
1. tsc clean · build exit 0 (murni styling, harusnya mulus).
2. Tiap halaman §2 punya 1 focal `.btn-primary` jelas; aksi lain secondary/ghost.
3. Status/hasil pakai warna semantik konsisten se-app.
4. 0 logika/handler berubah (diff murni className/markup presentational).
5. Gak ada raw `<button>` ad-hoc dgn style violet hardcode di halaman utama (ganti ke `.btn-*`).

## 5. SMOKE LIVE
- **S1** Screenshot before/after 4 halaman utama (dashboard, campaign-monitor, media, system) → focal CTA & hierarki jelas, warna semantik.
- **S2** Klik-through: tombol primary vs secondary keliatan beda; status warna sesuai.
- **S3** Regresi: semua aksi (yg cuma di-restyle) tetap berfungsi — gak ada handler putus.
Jujur (screenshot kalau bisa; kalau headless gagal → code audit + sebut keterbatasan).

## 6. EKSEKUSI & LAPORAN
- Branch `feat/design-system-app-wide`. Commit per kelompok halaman. Jangan merge sendiri.
- DILARANG: ubah logika/handler/endpoint; bikin token warna baru di luar yang ada; ganti aksen brand (violet tetap).
- LAPOR MAC AUDIT: `git diff --stat` TWO-DOT (cek nol file nyasar), konfirmasi diff presentational (grep handler/fetch gak berubah), per-halaman before/after, STATUS.

## 7. ⚠️ CLEANUP
`git rm docs/blueprints/design-system-app-wide-blueprint.md` setelah deploy SUKSES. Lihat [[feedback-delete-blueprints-after-deploy]].
```
