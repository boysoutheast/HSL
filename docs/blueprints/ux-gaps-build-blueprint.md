# Blueprint: Bangun Semua UX Gap — End-to-End, Per-List

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION
**Auditor:** Fable 5 · **Executor:** Sonnet (VPS)
**Estimasi:** 4–6 jam (besar — commit per item)

> Sumber gap: docs/full-ux-functional-audit-report.md (215 fungsi diaudit). Bangun TIAP
> item di list sampai END-TO-END (schema bila perlu → endpoint → UI → smoke test). Tiap
> item = 1 unit kerja terpisah + commit sendiri. JANGAN gabung.
>
> BLOCKER: sistem belum punya infra email (notif cuma Telegram). P0 (forgot-password,
> email-verif) butuh email → PHASE 0 dulu.

---

## PHASE 0 — Infra Email (prereq P0)

### Item 0.1 — `src/lib/email.ts` abstraksi sendEmail (Resend)
- Buat `sendEmail({ to, subject, html })` pakai Resend API (`RESEND_API_KEY`).
- **Best-effort / graceful** (pola `notify.ts`): kalau `RESEND_API_KEY` belum diset → `console.warn` + return false, JANGAN crash. Return boolean sukses.
- `FROM` dari env `EMAIL_FROM` (mis. `Hermes <noreply@boytenggara.com>`).
- Tambah ke `.env.example`: `RESEND_API_KEY=`, `EMAIL_FROM=`.
- **ACTION Boy (tulis di report):** buat akun Resend + verify domain pengirim + set `RESEND_API_KEY` & `EMAIL_FROM` di Railway. Sampai itu, email cuma ke-log (fitur tetap kebangun, tinggal aktif).

Commit: `feat(email): sendEmail abstraction via Resend (graceful)`

---

## P0 — FATAL (per item)

### Item 1 — Forgot / Reset Password (end-to-end)
Schema (`prisma/schema.prisma` + migration IF NOT EXISTS):
- Model `PasswordResetToken { id, userId, tokenHash (sha256), expiresAt, usedAt?, createdAt }` — token disimpan HASH, bukan plaintext.

Endpoint:
- `POST /api/admin/auth/forgot-password` — body `{ email }`. Selalu balik `{ ok: true }` (JANGAN bocorin email ada/nggak — anti user-enumeration). Kalau email valid: generate token random (32 byte), simpan hash + expiry 1 jam, `sendEmail` link `${BASE}/reset-password?token=...`. Rate-limit per email.
- `POST /api/admin/auth/reset-password` — body `{ token, password }`. Validasi: token hash cocok + belum expired + belum used → set password baru (hash), tandai usedAt, invalidasi semua session user itu. Validasi kekuatan password (min 8).

UI:
- `/forgot-password` page — form email → submit → pesan "cek email kalau terdaftar".
- `/reset-password` page — baca `?token`, form password baru + konfirmasi → submit → redirect login.
- Link **"Lupa password?"** di `/login`.

Smoke: request reset → cek email ke-log/terkirim → buka link → set password → login dgn password baru. Cleanup token.
Commit: `feat(auth): forgot/reset password flow end-to-end`

### Item 2 — Email Verification (end-to-end)
Schema: tambah `emailVerified DateTime?` + reuse pola token (model `EmailVerificationToken` atau gabung). 
Flow:
- Saat register sukses: generate token, `sendEmail` link `${BASE}/verify-email?token=...`.
- `GET /api/admin/auth/verify-email?token=` — validasi → set `emailVerified`, redirect ke login dgn pesan sukses.
- UI: setelah register, tampilkan state "cek email buat verifikasi" + tombol **Resend** (`POST /api/admin/auth/resend-verification`).
- Keputusan login-gating: user belum verified → tetap boleh login TAPI tampil banner "verifikasi email" (jangan kunci keras — biar gak buntu kayak forgot-password). Approval admin tetap jalan seperti sekarang.

Smoke: register → token ke-log → verify link → emailVerified terisi.
Commit: `feat(auth): email verification + resend`

---

## P1 — CORE (per item)

### Item 3 — Delete User (admin-users)
- `DELETE /api/admin/admin-users/[id]` — `requireAdmin`. Guard: TIDAK boleh hapus diri sendiri, tidak boleh hapus admin terakhir. Pertimbangkan: hard-delete vs soft-delete. **Default: soft-delete** (set `status='deleted'` + anonymize email opsional) biar FK (campaign/data) gak putus — cek relasi di schema dulu. Kalau aman hard-delete, boleh.
- UI `/admin-users`: tombol Delete per baris + **modal konfirmasi** (pakai `components/ui/Modal`, bukan confirm() native). Sembunyikan tombol buat diri sendiri.
Smoke: buat user dummy → delete → hilang dari list. Coba delete diri sendiri → ditolak.
Commit: `feat(admin-users): delete/soft-delete user with guards`

### Item 4 — Change Password (Settings)
- `POST /api/admin/profile/change-password` — `requireAuth`. Body `{ currentPassword, newPassword }`. Verifikasi current dulu (timing-safe), set baru (hash, min 8), opsional invalidasi session lain.
- UI di `/settings`: section "Ubah Password" — current + new + confirm → submit + feedback.
Smoke: ganti password → logout → login dgn password baru.
Commit: `feat(settings): change password`

---

## P2 — POLISH (per item)

### Item 5 — Empty States
- Identifikasi halaman list yang render blank pas data kosong (dari report). Untuk tiap: tambah empty-state (ikon + 1 kalimat + CTA ke aksi create). Buat komponen reusable `components/ui/EmptyState.tsx`.
- List target minimal: accounts, campaign-monitor, media-library, ceps, topics, products, automation-rules, admin-users, agents.
Commit: `feat(ux): empty states with CTA across list pages`

### Item 6 — Ganti `window.confirm()` → modal kustom
- `grep -rn "window.confirm\|confirm(" src/app --include="*.tsx"` → tiap pemakaian ganti pakai `components/ui/Modal` confirm pattern (atau bikin `useConfirm` hook).
Commit: `feat(ux): replace native confirm with custom modal`

### Item 7 — Search / Filter di list panjang
- Untuk list yang berpotensi panjang (admin-users, accounts, campaign-monitor, media-library, ceps, products): tambah input search (client-side filter minimal) + filter status kalau relevan.
Commit: `feat(ux): search/filter on long list pages`

### Item 8 — Onboarding (checklist/tooltip)
- Dashboard `/`: kalau user baru (belum connect Meta / belum ada campaign), tampilkan **checklist onboarding** (Connect Meta → Buat account → Generate → Launch). Link tiap step. Simpel, gak perlu library tour.
Commit: `feat(ux): onboarding checklist for new users`

---

## ATURAN WAJIB (GUARDRAIL)
- **DILARANG reset/ubah password produksi buat testing.** Pakai user DUMMY yang lo buat sendiri buat smoke test, hapus setelahnya. Jangan dump secret/hash ke file. (Lo udah 1× langgar — jangan ulangi.)
- Migration: IF NOT EXISTS, no destructive. Cek relasi sebelum hard-delete user.
- Token reset/verif disimpan HASH (sha256), JANGAN plaintext. Expiry wajib. Anti user-enumeration (forgot-password selalu balik ok).
- Tiap item: schema(bila perlu)→endpoint→UI→smoke. Commit PER ITEM. tsc + npm run build WAJIB lulus tiap commit (selain driver.js). DILARANG force-push. git pull --rebase kalau ketolak.
- **Anti-ngarang (report lo pernah palsu):** report WAJIB paste bukti mentah per item — endpoint response, file yang dibuat, smoke result. `git rev-parse origin/main` akhir + tsc/build tail. Fable cross-check sendiri (cek file endpoint/page beneran ada + git log).

## Report: `docs/ux-gaps-build-report.md`
Tabel per item (8 item + 0.1): file dibuat | endpoint | UI | smoke PASS/DEFERRED | commit. Plus ACTION Boy (Resend key+domain). git rev-parse origin/main + tsc/build.

Kirim ke Boy: status per item (DONE/DEFERRED) + commit hashes + git rev-parse origin/main + smoke results + ACTION (Resend setup).
