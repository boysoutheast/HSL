# Blueprint: Multi-Tenant Meta OAuth + Asset Picker (skala 20k user)

**Author:** Fable 5 · **Executor:** Sonnet · **Auditor:** Fable 5 · **Tanggal:** 2026-06-13
**Tujuan:** HSL dari single-tenant (owner) → SaaS multi-user. Tiap user connect Meta-nya sendiri lewat asset-picker (kayak Birch), aset ter-isolasi per user, worker eksekusi per-tenant. Target: 20.000 user aktif.

---

## 0. ⚠️ DUA TEMUAN KRITIS — WAJIB BERES SEBELUM USER KE-2 MASUK

Ditemukan auditor saat survey. Ini bukan fitur — ini lubang yang meledak persis saat multi-user nyala.

### KRITIS-1: `ENCRYPTION_KEY` TIDAK DISET DI PRODUKSI
- `src/lib/crypto.ts` fallback ke hardcoded `'hsl-dev-key-not-for-production-change-me'`.
- Artinya SEMUA Meta token user saat ini dienkripsi pakai key yang ada di source code. Di 20k user = siapa pun yang lihat repo bisa dekripsi token semua orang → ambil alih ad account mereka.
- **Aksi (OWNER, sebelum apa pun):**
  1. Generate key kuat: `openssl rand -base64 48`
  2. Set `ENCRYPTION_KEY` di Railway (service hermes-support-web).
  3. ⚠️ Token lama (dienkripsi pakai dev key) jadi TIDAK terbaca setelah key ganti — owner reconnect Meta-nya sekali. Aman karena sekarang baru 1 tenant.
- **Aksi (CODE, F0):** crypto.ts → kalau `ENCRYPTION_KEY` tidak diset DAN `NODE_ENV==='production'` → throw saat startup (fail loud), jangan diam-diam pakai dev key.

### KRITIS-2: TENANT ISOLATION BELUM LENGKAP
- `ownerFilter()` dipakai cuma di **9 file**. Banyak route meta-tools (adaccount-capabilities, interest-search, adspixels, customaudiences) query `MetaAccount`/`MetaAdAccount` **tanpa scope userId**.
- Di single-tenant nggak keliatan (cuma ada 1 user). Di multi-tenant: user A bisa baca/pakai ad account user B → kebocoran lintas-tenant + bisa belanja pakai akun orang lain.
- `ownerFilter` juga `return {}` untuk admin (bypass penuh) — oke buat owner, tapi tiap akun SaaS WAJIB role `user`, jangan `admin`.
- **Ini risiko #1 di seluruh blueprint.** Fase F4 khusus nutup ini, dan acceptance-nya paling ketat.

**Aturan global:** zero data loss, additive migration only (ada migration di sini — beda dari IA rework). Commit per fase. Token JANGAN pernah masuk log/response/memory. No force-push.

---

## 1. Model Mental Target

```
User signup → login Meta (asset picker Meta-hosted) → pilih Page/IG/Ad account
  → callback: exchange code → long-lived token → simpan terenkripsi (per user)
  → sync HANYA aset yang user pilih ke DB (scoped userId)
  → semua query/worker action difilter userId
  → token refresh otomatis (cron) → reconnect flow kalau expired/revoked
```

Prinsip: **tiap baris data Meta punya pemilik (userId). Tidak ada query lintas-tenant tanpa userId. Worker resolve token+izin dari userId task, bukan env global.**

---

## 2. F0 — Hardening prasyarat (paling dulu, kecil tapi wajib)

1. crypto.ts: throw di production kalau `ENCRYPTION_KEY` absen (KRITIS-1 code side).
2. Registrasi self-serve: pastikan user baru SELALU role `user` + status `pending` (cek `auth/register` route). Tidak ada jalur jadi `admin` dari signup.
3. Tambah index DB untuk query bertenant yang sering (additive migration): `meta_accounts(user_id, status)`, dan pastikan FK userId ada index. (cek dulu, banyak udah ada.)

Verify: build hijau; set ENCRYPTION_KEY di staging → reconnect → token kebaca.

## 3. F1 — Config Meta dashboard (OWNER action, didokumentasikan)

Asset-picker (screenshot Birch) dirender Meta, BUKAN kode kita. Muncul kalau config-nya tipe **Facebook Login for Business** yang minta asset types (pages, IG, ad accounts).

- **Owner:** di Meta App "taracare media buyer" → Facebook Login for Business → Configurations → buat/sesuaikan config tipe yang nampilin asset selection (Business portfolio + Page + IG + Ad account). Catat config_id baru.
- **Code:** `META_LOGIN_CONFIG_ID` di Railway diganti ke config baru. start/route.ts SUDAH pakai config_id — kemungkinan zero code change, cukup env. Verify URL OAuth bawa config_id baru.
- Dokumentasikan langkah dashboard di `docs/meta-login-setup.md` (buat onboarding user & referensi).

## 4. F2 — Callback: sync aset terpilih, scoped per user

`meta-oauth/callback/route.ts`:
1. Exchange code → short-lived → **long-lived token** (`/oauth/access_token?grant_type=fb_exchange_token`). Simpan `longLivedTokenEncrypted` + `tokenExpiry` (≈60 hari).
2. Simpan `scopesJson` = granted scopes dari response (`/me/permissions`).
3. Sync aset yang USER PILIH (bukan semua): ad accounts (`/me/adaccounts`), pages (`/me/accounts`), IG business (`/page?fields=instagram_business_account`). Upsert ke `meta_ad_accounts`/`meta_pages` dengan FK ke MetaAccount user itu. Hanya aset yang ke-grant.
4. `MetaAccount.userId` = user yang login (dari sesi). Connection unik per (userId, metaUserId).
5. Error handling: user batal / scope ditolak sebagian → status `needs_reconnect` + pesan jelas, jangan setengah-sync diam.

Verify: 2 user beda login Meta beda → masing-masing cuma lihat aset sendiri di DB.

## 5. F3 — Token lifecycle di skala 20k

20k user = 20k long-lived token yang harus dijaga hidup. Token Meta ~60 hari, bisa revoked kapan aja.
1. Cron baru `POST /api/cron/refresh-tokens` (x-cron-secret): query token yang `tokenExpiry < now + 7 hari` ATAU `lastTokenCheckAt` basi → refresh / debug_token. Batch + rate-limit aware (jangan hajar Meta sekaligus; proses N per run, cron tiap jam). Update status `connected|expired|needs_reconnect|revoked`.
2. Tambah cron service Railway (pattern sama 4 cron existing, pakai `ai.boytenggara.com`).
3. UI: banner "Koneksi Meta perlu disambung ulang" kalau status != connected, dengan tombol reconnect (re-run OAuth, pertahankan connection id).
4. Saat token revoked → JANGAN hapus data; tandai, hold worker task akun itu, notify user.

Verify: paksa 1 token expiry ke masa lalu → cron tandai needs_reconnect → banner muncul.

## 6. F4 — TENANT ISOLATION AUDIT (risiko #1, paling ketat)

1. Audit SISTEMATIS tiap route yang nyentuh data Meta/launch/media/campaign: WAJIB filter userId (lewat `ownerFilter` atau eksplisit). Buat daftar lengkap route + status sebelum-sesudah.
2. Khusus meta-tools (adaccount-capabilities, adspixels, customaudiences, interest-search): sebelum graphFetch, VERIFIKASI ad account/connection yang diminta MILIK user pemanggil (join userId). Sekarang kemungkinan nggak — ini bug lintas-tenant.
3. Helper `assertOwnsConnection(userId, connectionId)` / `assertOwnsAdAccount(userId, adAccountId)` di lib, dipakai di SEMUA route yang terima id dari client.
4. Test adversarial WAJIB di acceptance: user A coba akses connectionId/adAccountId/launchId milik user B → harus 403/404, BUKAN data B.

## 7. F5 — Worker multi-tenant

Sekarang worker pakai SATU env global `HERMES_WORKER_WRITE_ALLOWED_AD_ACCOUNTS`. Di 20k user ini mustahil.
1. Worker resolve per-task: dari `task.userId` → ambil token user itu (terenkripsi, didekripsi di worker) → operasi Meta pakai token user ybs, BUKAN token global.
2. Write-gate per-tenant: aksi write cuma boleh ke ad account yang (a) milik user task, (b) status connection `connected`. Hapus ketergantungan allowlist env global (atau jadikan kill-switch global saja).
3. Token didistribusi ke worker via API internal yang udah ada (`/api/worker/tokens/[metaConnectionId]`) — pastikan endpoint itu sendiri scoped & cuma kasih token kalau task milik connection itu.
4. Rate limit: Meta limit per-token (bagus, ke-spread antar user), tapi app-level call volume di 20k user gede — worker harus backoff saat kena rate-limit Meta, jangan retry blind.

Verify: task user A diproses pakai token A; task ad account yang bukan milik user task → failed WRITE_BLOCKED.

## 8. F6 — Onboarding & UX SaaS

1. Halaman connect Meta yang jelas (di /system?tab=connections atau onboarding wizard user baru): tombol "Hubungkan Meta" → OAuth asset-picker → balik tampil aset ke-connect.
2. Empty state seluruh app sadar "belum connect Meta" → arahkan ke connect dulu.
3. Quota/plan (kalau ada model bisnis): batasi jumlah ad account / launch per user — TANDAI sebagai hook, jangan implement tanpa keputusan owner.

### F6b — Asset Manager pasca-connect (3 tab, kayak Birch)

Setelah OAuth + sync (F2), user butuh layar kelola aset yang ke-connect. Referensi: Birch "Meta Ads" — 3 tab horizontal, tiap tab tabel aset + search + status.

UI di `/system?tab=connections` (atau sub-halaman): header "X profil terhubung", 3 tab:
- **Ad accounts** — nama + `act_ID` + currency + accountStatus (Active/Disabled badge)
- **Facebook Pages** — nama + page ID + status
- **Instagram accounts** — username + IG business ID + status

Tiap tab: search by nama/ID, baca dari `meta_ad_accounts`/`meta_pages`/IG (yang udah di-sync F2, scoped userId). Tabel ringan, pagination/virtualize kalau >50 baris (akun ini punya 17 IG + 21 page — pasti banyak).

**Aksi per baris — JANGAN bikin model "workspace" baru** (itu konsep Birch; kita nggak punya, dan bikin tabel baru = keputusan owner). Ekuivalen HSL pakai yang SUDAH ada:
- Toggle **enable/disable** aset untuk dipakai HSL (kolom status existing / flag `isActive` — cek dulu, kalau perlu kolom baru itu migration additive + lapor).
- **Assign ke Hermes Agent** via `Assignment` model existing (assignableType `instagram_account`/`ad_account`/dll) — dropdown "assign ke agent". Ini ekuivalen "link to workspace"-nya Birch.

Default tampilan: read-only list dulu (lihat semua aset ke-sync). Aksi enable/assign boleh nyusul kalau bikin scope membengkak — tapi 3-tab viewer + search + status WAJIB ada.

Acceptance F6b: 2 user beda → tiap user cuma lihat aset Meta-nya sendiri di 3 tab (ini juga test isolation F4); search jalan; status badge akurat vs DB.

---

## 9. Urutan Eksekusi

| Fase | Isi | Blocking? |
|---|---|---|
| F0 | Hardening (ENCRYPTION_KEY guard, role user, index) | YA — sebelum semua |
| F1 | Config Meta dashboard + env (owner + doc) | YA — sebelum F2 test |
| F2 | Callback sync aset scoped | |
| F4 | Tenant isolation audit | **YA sebelum user ke-2 nyata masuk** |
| F3 | Token lifecycle + cron refresh | |
| F5 | Worker multi-tenant | YA sebelum write-mode multi-user |
| F6 | Onboarding UX | |

Catatan jujur ke owner: **F4 (isolation) + F5 (worker multi-tenant) lebih besar & lebih berisiko dari asset-picker (F1+F2) yang keliatan.** Asset-picker itu ujung gunung es; isolation + token lifecycle + worker per-tenant itu badan es-nya. Jangan kirim 20k user sebelum F0+F4+F5 lulus acceptance.

## 10. Acceptance (produksi/staging, paling ketat di F4)

1. F0: ENCRYPTION_KEY absen di NODE_ENV=production → app refuse start (log jelas).
2. F1: OAuth URL bawa config_id baru → Meta tampilkan asset picker (screenshot bukti).
3. F2: 2 user uji login Meta beda → DB: aset masing-masing terisolasi, scopesJson keisi, long-lived token + expiry tersimpan.
4. **F4 ADVERSARIAL (wajib):** user A autentikasi, panggil tiap endpoint sensitif dengan id milik user B (connection, adAccount, launch, media, capabilities, adspixels, customaudiences) → SEMUA 403/404, nol kebocoran. Tabel hasil per endpoint.
5. F3: token dipaksa mau-expired → cron refresh-tokens tandai + banner reconnect muncul → reconnect berhasil tanpa kehilangan data.
6. F5: task user A pakai token A (verifikasi di log worker mana token dipakai — JANGAN log token-nya, cukup connectionId); write ke ad account bukan milik task → WRITE_BLOCKED.
7. Regresi: owner (tenant existing) tetap jalan penuh setelah semua fase.
8. Zero data loss: COUNT meta_accounts/meta_ad_accounts/test_launches sebelum-sesudah konsisten (kecuali penambahan dari test).

---

## 11. Aturan migration (ADA migration di blueprint ini)

Beda dari IA rework — di sini boleh ALTER TABLE, TAPI: additive only (ADD COLUMN/INDEX IF NOT EXISTS), no drop, no rename kolom existing, no `cuid()`/`randomblob` default, SEMUA camelCase WAJIB `@map`, `npx prisma generate` → `npm run build` sebelum commit. Satu migration per fase yang butuh.

---

## 12. Out of Scope (jangan dikerjain tanpa keputusan owner)

Billing/subscription, kuota plan, custom domain per tenant, SSO, audit-log compliance, GDPR data-export/delete tooling. Tandai sebagai backlog SaaS — butuh keputusan model bisnis dulu.

---

*Eksekusi per fase via workflow blueprint → Sonnet → audit Fable 5. F0/F4/F5 acceptance balik ke auditor sebelum dianggap aman buka multi-user.*
