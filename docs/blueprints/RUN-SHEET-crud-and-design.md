# RUN-SHEET (End-to-End) — Blueprint C + B sampai LIVE

**Owner:** Boy · **Executor:** Sonnet (VPS) · **Date:** 2026-06-21
**Cara pakai:** Jalanin SEMUA fase ini sampai tuntas TANPA nunggu approval per-langkah. Eksekusi → build → merge → deploy → **smoke LIVE** → **self-audit** → baru lapor SEKALI di akhir. Fable audit final 1× saja.

Blueprint detail udah ada (jangan re-spec, ikutin):
- C = `docs/blueprints/crud-completeness-blueprint.md` (KODE UDAH SELESAI di branch `feat/crud-completeness` @4f6f908, ACC Fable — tinggal merge+deploy+smoke).
- B = `docs/blueprints/design-system-app-wide-blueprint.md` (BELUM dikerjain).

Ambil keduanya: `git fetch origin docs/crud-and-design && git checkout origin/docs/crud-and-design -- docs/blueprints/crud-completeness-blueprint.md docs/blueprints/design-system-app-wide-blueprint.md`

---

## ATURAN GLOBAL (semua fase)
1. **JANGAN commit file nyasar** — no scripts scratch, no tsconfig hack, no blueprint .md ke feature branch. Cek `git diff --stat origin/main..HEAD` HARUS cuma file yang relevan.
2. **TWO-DOT diff** (`origin/main..HEAD`) buat cek delta, BUKAN three-dot.
3. **Klaim PASS wajib bukti runtime** (curl/HTTP code/DB readback/screenshot). "Build verified" ≠ smoke. Jujur mana yang live vs code-only.
4. Migration → pastiin `prisma migrate deploy` SUKSES di log Railway.
5. Gak ada guard di-drop; admin-bypass JANGAN bocor ke non-admin.

---

## FASE 1 — Blueprint C (merge → deploy → smoke LIVE)
Kode udah ACC. Langkah:
1. `git fetch origin && git reset --hard origin/feat/crud-completeness`
2. `npx tsc --noEmit` + `npm run build` → paste hijau.
3. **Self-audit C (paste bukti tiap baris):**
   - `git diff --stat origin/main..HEAD` → 0 file nyasar.
   - `grep -rn 'window.confirm' src/app` = 0.
   - Tiap DELETE yang difix: pola `...(role==='admin'?{}:{userId})` — admin lewat, non-admin ke-block.
4. MERGE: `git checkout main && git pull && git merge --no-ff feat/crud-completeness && git push origin main`.
5. DEPLOY: tunggu Railway SUCCESS + migration `enabled_for_automation` applied (paste log). Catat commit.
6. **SMOKE LIVE** (ad account billing 1178670036856360) — bukti tiap poin:
   - S1: matiin 1 ad account → scan campaign akun itu → skip (`ad_account_disabled` di log). Nyalain → jalan lagi.
   - S2: hapus character → ConfirmDialog muncul → confirm hapus; cancel = gak kehapus.
   - S3 ⭐: admin hapus campaign-session punya USER LAIN → berhasil. Non-admin hapus punya orang → 404.
   - S4: revoke API key → ADA konfirmasi.
   - S5: regresi delete products/accounts/meta-conn via ConfirmDialog jalan.

---

## FASE 2 — Blueprint B (execute → deploy → smoke LIVE)
Mulai SETELAH Fase 1 deploy SUKSES (B nge-style komponen yang C tambah).
1. Branch baru `feat/design-system-app-wide` dari main terbaru.
2. Eksekusi penuh sesuai blueprint B: token Pilot A (JANGAN bikin baru), 1 focal CTA/halaman, button hierarchy konsisten, status warna semantik, ganti raw `<button>` ad-hoc → `.btn-*`. **MURNI presentational — 0 logika/handler/fetch berubah.**
3. `npx tsc --noEmit` + `npm run build`.
4. **Self-audit B:** `git diff --stat origin/main..HEAD` (0 nyasar) + konfirmasi diff presentational (grep: gak ada perubahan di handler/fetch/endpoint).
5. MERGE → push main → DEPLOY tunggu SUCCESS.
6. **SMOKE LIVE:** screenshot before/after 4 halaman utama (dashboard, campaign-monitor, media, system) — focal CTA & warna semantik jelas. Klik-through: aksi tetap jalan (regresi). Kalau headless gagal screenshot → code audit + sebut keterbatasan jujur.

---

## FASE 3 — CLEANUP
Setelah C & B dua-duanya deploy SUKSES:
`git rm docs/blueprints/crud-completeness-blueprint.md docs/blueprints/design-system-app-wide-blueprint.md docs/blueprints/RUN-SHEET-crud-and-design.md` → commit `chore: cleanup deployed blueprints` → push main.

---

## LAPORAN AKHIR (SEKALI, buat audit final Fable)
Format MAC AUDIT, gabungan C + B:
1. **C:** build · self-audit (diff/window.confirm/admin-bypass) · merge commit · deploy+migration · SMOKE S1–S5 (PASS/FAIL+bukti).
2. **B:** build · diff presentational · merge commit · deploy · SMOKE before/after.
3. **Cleanup:** 3 blueprint kehapus (`git ls-tree` bukti).
4. **STATUS** per fase + commit hash main final.
Jujur: FAIL → symptom+hipotesis+fix, jangan sembunyiin. Yang code-only (bukan live) sebut eksplisit.

> Fable bakal audit final 1×: `git log main`, Railway deploy via MCP, two-dot diff bersih, admin-bypass spot-check, grep window.confirm=0. Kalau ada yang nyangkut, balik ke fase itu.
```
