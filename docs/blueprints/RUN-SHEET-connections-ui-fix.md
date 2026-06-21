# RUN-SHEET (End-to-End) — Connections UI Fix (blob ad-account)

**Owner:** Boy · **Executor:** Sonnet (VPS) · **Date:** 2026-06-21
**Masalah:** Section "🔗 Meta Connections" di `/system?tab=connections` nampilin ~60 ad account sebagai **1 paragraf teks abu di-join koma** (`ConnectionsTab.tsx:244` `adAccounts.map(...).join(', ')`) → gak kebaca, gak bisa dikelola. Skor 2/10.
**Cara pakai:** Jalanin END-TO-END (execute → build → merge → deploy → smoke → self-audit), lapor SEKALI. Fable audit final 1×.

---

## SCOPE (presentational + UI, low-risk)
Toggle enable/disable ad-account UDAH ADA di detail page `/meta-connections/[id]`. JANGAN duplikat logic — di ConnectionsTab cukup bikin RINGKAS + jalan ke detail buat kelola.

### Fix `src/app/system/ConnectionsTab.tsx` Meta Connections section (~line 230-250):
Ganti blob `adAccounts.map(...).join(', ')` jadi:
1. **Ringkasan count**, bukan dump semua: `{c.adAccounts.length} ad account` + (kalau ada data) `· {enabledCount} aktif automation`. (Kalau `enabledForAutomation` belum ada di payload `connections/meta`, tambah ke select endpoint — opsional; minimal tampilin total count.)
2. **Chip ringkas** maks 3-5 nama pertama + "…+{sisa} lainnya" (jangan semua 60).
3. **Tombol "Kelola →"** ke `/meta-connections/{c.id}` (tempat toggle enable/disable per akun udah ada).
4. Nama koneksi tetap link ke detail (udah ada dari Pilot A).
5. Card rapi: status pill (Terhubung=emerald udah semantik), "Terakhir dipakai" kecil, jangan padet.

### Backend (opsional, kalau mau tampil "X aktif"):
`GET /api/admin/connections/meta` (`route.ts`) — di map adAccounts, tambah `enabledForAutomation: acc.enabledForAutomation`. (Field udah ada di schema.) Lalu ConnectionsTab hitung enabledCount. Kalau ribet, SKIP — cukup total count + Kelola link.

### JANGAN
- Jangan dump 60 akun lagi. Jangan duplikat toggle di ConnectionsTab (cukup link ke detail). Jangan ubah logika koneksi/handler.

---

## ACCEPTANCE
1. tsc clean · build exit 0.
2. ConnectionsTab Meta section: ad account tampil sebagai **count + chip ringkas + tombol Kelola**, BUKAN paragraf 60-akun.
3. "Kelola →" buka `/meta-connections/[id]` (toggle per-akun jalan di sana).
4. Diff presentational (+ opsional 1 baris backend select). 0 logika koneksi berubah.

## SMOKE LIVE
- **S1** `/system?tab=connections` (Taracare, 60 akun) → tampil ringkas (count + beberapa chip + Kelola), gak ada wall-of-text. Screenshot.
- **S2** Klik "Kelola →" → detail page, toggle enable/disable ad account jalan (regresi Blueprint C). Screenshot.
- **S3** Regresi: Hubungkan Meta / Tambah manual / Credit / Developer-collapse masih jalan.

## EKSEKUSI & LAPORAN
- Branch `feat/connections-ui-fix`. Commit kecil. Build → merge → deploy → smoke.
- LAPOR SEKALI: git diff TWO-DOT (presentational), build, merge+deploy commit, smoke S1–S3 + screenshot, STATUS.
- CLEANUP: `git rm docs/blueprints/RUN-SHEET-connections-ui-fix.md` abis deploy.

> Fable audit final 1×: main log, deploy via MCP, ConnectionsTab gak ada `.join(', ')` blob lagi, two-dot bersih.
```
