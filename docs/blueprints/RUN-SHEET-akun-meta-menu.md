# RUN-SHEET (End-to-End) — Promote "Akun Meta" jadi Menu Sendiri

**Owner:** Boy · **Executor:** Sonnet (VPS) · **Date:** 2026-06-21
**QUEUE:** Kerjain SETELAH PR-2 (testing-scaling) selesai deploy. Jangan barengan.
**Supersede:** `RUN-SHEET-connections-ui-fix.md` (yang cuma fix blob in-place) — ini lebih bener: angkat jadi menu sendiri.

**Masalah:** Manajemen Meta connection + 44 ad account (toggle enable, edit, kredensial) konten BERAT, ke-sumpel di tab `System → Connections` + ke-render jadi blob teks 44-akun gak kebaca, gak bisa dikelola di situ.
**Solusi:** Jadikan **menu top-level "Akun Meta"** (page `/meta-connections` + detail UDAH ADA, tinggal diangkat + dirapihin). Slim-in tab System.

**Cara pakai:** END-TO-END (execute → build → merge → deploy → smoke → self-audit), lapor SEKALI. Fable audit final 1×.

---

## 1. NAV — tambah pillar "Akun Meta"
`src/components/Sidebar.tsx` (~line 23-28, sekarang 6 pillar):
- Tambah `{ label: 'Akun Meta', href: '/meta-connections', icon: <ikon link/plug> }`. → jadi **7 pillar (ganjil, ≤7)** ✅ sesuai aturan nav.
- Posisi: sesudah "Meta Ads" (konteks nyambung) atau sebelum System.

## 2. `/meta-connections` (list) — jadiin HOME yang proper
File `src/app/meta-connections/page.tsx`:
- Header: judul "Akun Meta" + focal CTA "➕ Hubungkan Meta" (.btn-primary) + "Tambah manual" (.btn-secondary).
- Tiap koneksi = card: nama + status pill (emerald) + **ringkasan ad account (count, BUKAN blob)** + tombol "Kelola →" ke detail.
- Bersih, gak ada wall-of-text.

## 3. `/meta-connections/[id]` (detail) — manajemen ad account yang KEBACA (44 akun)
File `src/app/meta-connections/[id]/page.tsx` (toggle enabledForAutomation UDAH ADA dari Blueprint C):
- Ad account JANGAN blob — render sebagai **tabel/list per baris**: nama · ID · status · **toggle Aktif-automation**.
- **WAJIB ada search/filter** (44 akun) — input cari nama/ID. Boleh + pagination/virtualize kalau perlu.
- Bulk action opsional: "Aktifin semua / Matiin semua" (pakai endpoint bulk `/ad-accounts` yang udah ada).
- Edit metadata + Perbarui Kredensial (udah ada Pilot A) tetap.

## 4. `System → Connections` tab — SLIM-IN
File `src/app/system/ConnectionsTab.tsx`:
- **HAPUS section "🔗 Meta Connections"** (blob 44-akun) dari sini — pindah ke menu Akun Meta.
- Ganti dengan **pointer 1 baris**: "Kelola akun Meta & ad account di menu **Akun Meta →**" (link `/meta-connections`).
- Sisa di tab System: Credit Balance + Developer/API collapse (udah ada). Jadi tab System fokus ke API key & credit aja.

## 5. ACCEPTANCE
1. tsc clean · build exit 0.
2. Nav punya "Akun Meta" (7 pillar, ganjil) → `/meta-connections`.
3. `/meta-connections` list bersih (count + Kelola, no blob). Detail: ad account per-baris + toggle + SEARCH (44 akun kebaca & bisa difilter).
4. Tab System gak ada lagi blob Meta — cuma pointer + Credit + Dev/API.
5. Diff presentational + nav (0 logika koneksi/toggle berubah; toggle/endpoint Blueprint C dipakai apa adanya).

## 6. SMOKE LIVE
- **S1** Nav → klik "Akun Meta" → `/meta-connections` list bersih. Screenshot.
- **S2** Buka Taracare detail → 44 ad account per-baris, search jalan (ketik "Glazing" → kefilter), toggle aktif/non jalan. Screenshot.
- **S3** `/system?tab=connections` → blob Meta HILANG, ada pointer ke Akun Meta + Credit + Dev/API. Screenshot.
- **S4** Regresi: Hubungkan Meta/Tambah manual/edit/kredensial masih jalan.

## 7. EKSEKUSI & LAPORAN
- Branch `feat/akun-meta-menu`. Build → merge → deploy → smoke. Lapor SEKALI MAC AUDIT + git diff TWO-DOT.
- CLEANUP: `git rm docs/blueprints/RUN-SHEET-akun-meta-menu.md` + `RUN-SHEET-connections-ui-fix.md` (superseded) abis deploy.

> Fable audit final 1×: nav 7 pillar, ConnectionsTab gak ada `.join(', ')` blob, /meta-connections detail punya search+toggle, deploy via MCP, two-dot bersih.
```
