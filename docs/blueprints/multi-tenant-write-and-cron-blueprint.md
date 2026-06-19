# Blueprint: Multi-Tenant Write Permission + Cron Opt-In Scheduling

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION (Sonnet)
**Estimasi:** 2–3 jam · Fondasi multi-tenant 2000 user. Kerjain SEBELUM nyalain automation.
**Tujuan:** (1) Izin write digerakin ownership user, bukan env allowlist manual. (2) Cron cuma nyentuh campaign yang user nyalain, di interval yang dia pilih sendiri.

---

## BAGIAN 1 — Write Permission Ownership-Driven (#1)

### Masalah sekarang
`scan-campaigns` + `topup-campaigns` gate write pakai `isAllowed(adAccountId)` baca env `HSL_WRITE_ALLOWED_AD_ACCOUNTS`. Buat 2000 user, masukin tiap ad account manual ke Railway = mustahil. Ini warisan era worker (safety testing).

### Prinsip baru
Izin write itu **implisit dari ownership + token valid**, BUKAN env:
- Session udah scoped `userId` (ada).
- Ad account yang di-write WAJIB milik user itu: `MetaAdAccount` → `metaAccount.userId === session.userId`.
- Token akun itu valid (belum expired/revoked).
- → tiga itu kepenuhin = user berhak write. Gak perlu env per-account.

Env **demote** jadi **global kill-switch opsional** (bukan gerbang per-account):
- `HSL_AUTOMATION_WRITES_ENABLED` (default `true`). Kalau `false` → SEMUA write cron berhenti (panic button insiden). Bukan daftar account.

### Implementasi
1. Bikin helper `src/lib/write-guard.ts`:
```ts
// Ganti isAllowed(env). Cek ownership + token, BUKAN allowlist env.
export async function canWriteToAdAccount(
  session: { userId: string; metaAdAccountId: string | null },
): Promise<{ ok: boolean; reason?: string; token?: string }> {
  // 0. Global kill-switch
  if (process.env.HSL_AUTOMATION_WRITES_ENABLED === 'false') return { ok: false, reason: 'writes_disabled_global' }
  if (!session.metaAdAccountId) return { ok: false, reason: 'no_ad_account' }

  // 1. Ad account milik user ini? (fail-closed)
  const acc = await prisma.metaAdAccount.findFirst({
    where: { id: session.metaAdAccountId, metaAccount: { userId: session.userId } },
    select: { adAccountId: true, metaAccount: { select: { longLivedTokenEncrypted: true, tokenExpiry: true, status: true } } },
  })
  if (!acc) return { ok: false, reason: 'not_owned' }

  // 2. Token ada + akun sehat (field SUDAH ADA: tokenExpiry + status connected|expired|needs_reconnect|revoked)
  const enc = acc.metaAccount.longLivedTokenEncrypted
  if (!enc) return { ok: false, reason: 'no_token' }
  if (acc.metaAccount.status !== 'connected') return { ok: false, reason: `account_${acc.metaAccount.status}` }
  if (acc.metaAccount.tokenExpiry && acc.metaAccount.tokenExpiry < new Date())
    return { ok: false, reason: 'token_expired' }

  return { ok: true, token: decode(enc) }
}
```
2. `scan-campaigns` + `topup-campaigns`: **ganti** `isAllowed(adAccountId)` → `canWriteToAdAccount(session)`. Kalau `!ok` → skip session + log reason (jangan apply, jangan error fatal). Reason `token_expired`/`not_owned` di-surface ke user nanti (gap C/E).
3. **HAPUS** `HSL_WRITE_ALLOWED_AD_ACCOUNTS` + fungsi `isAllowed`. Dokumentasiin di /docs kalau perlu.
4. ✅ Field token SUDAH ADA di `MetaAccount`: `tokenExpiry`, `status` (connected|expired|needs_reconnect|revoked), `lastTokenCheckAt`. GAK perlu migration. Write-guard tinggal baca. Pengisian/maintenance field ini = gap C (token lifecycle).

---

## BAGIAN 2 — Cron Opt-In + Per-User Interval (#2)

### Prinsip (permintaan owner)
**Cron TIDAK BOLEH nyentuh campaign kalau user gak mau.** Yang di-scan HANYA:
- `automationEnabled = true` (user EKSPLISIT nyalain), DAN
- `nextMonitorAt <= now` (udah waktunya per interval dia).

Interval = `monitorIntervalMinutes` per campaign, **user yang pilih** (default 5 menit). User bisa set 5/15/30/60. Gak ada scan paksa, gak ada default-on diam-diam.

### Yang sebenernya udah bener (jangan dibikin ulang)
`scan-campaigns` udah filter `status=RUNNING AND automationEnabled=true AND nextMonitorAt due`. Model `nextMonitorAt` = tiap campaign efektif punya "jadwal sendiri". Itu **pola bener** — 1 cron, jadwal per-row. JANGAN bikin 2000 cron job.

### Yang perlu dipastikan/diperbaiki
1. **Default interval 5 menit** — pas import/enable, `monitorIntervalMinutes` default 5 kalau user gak set. Konfirmasi di import route + PATCH session.
2. **Strict opt-in** — `scan-campaigns` + `topup-campaigns` WAJIB filter `automationEnabled=true` (scan) / `topupEnabled=true` (topup). Campaign yang user GAK nyalain = gak disentuh sama sekali. Verifikasi gak ada path yang nge-scan tanpa flag ini.
3. **Cron tick = 5 menit** (cukup buat sekarang, low user count). Catat di blueprint: kalau user banyak & campaign opted-in > ~300, naikin tick ke 1 menit + batch lebih gede + proses paralel (Promise.all dgn cap konkurensi, mis. 5). JANGAN over-engineer sekarang — `*/5` dulu.
4. **Set nextMonitorAt habis proses** — `nextMonitorAt = now + monitorIntervalMinutes` (udah ada, verifikasi). Ini yang bikin interval per-user jalan natural.
5. **topup interval** — sekarang topup cron `*/10`. Selaraskan: topup juga hormati per-session (boleh interval sendiri atau ikut monitorIntervalMinutes). Keputusan: topup ikut `monitorIntervalMinutes` campaign biar konsisten (1 interval per campaign, gak bingungin user).

### UI (kecil — biar user ngerti dia yang kontrol)
- Toggle "Automation ON/OFF" per campaign (udah ada) + dropdown interval (5/15/30/60 menit, default 5).
- Teks jelas: "HSL cek campaign ini tiap 5 menit. Matikan kalau gak mau dipantau." → user paham gak ada yang jalan diam-diam.

---

## Acceptance
- [ ] `canWriteToAdAccount`: write cuma ke ad account milik user (ownership), token valid; user lain 403/skip
- [ ] `HSL_WRITE_ALLOWED_AD_ACCOUNTS` + `isAllowed` DIHAPUS; diganti ownership check
- [ ] Global kill-switch `HSL_AUTOMATION_WRITES_ENABLED=false` → semua write cron berhenti
- [ ] scan/topup cron HANYA proses `automationEnabled=true` / `topupEnabled=true` (campaign non-opt-in gak disentuh — buktiin dgn test: campaign automationEnabled=false → 0 scan)
- [ ] Interval per-user dihormati (`nextMonitorAt` gating), default 5 menit
- [ ] Skip reason (not_owned/token_expired/no_token) di-log, gak error fatal
- [ ] UI: toggle + interval dropdown + teks "dicek tiap X menit"
- [ ] tsc 0 error · /docs update

## Execution Order
```
1. src/lib/write-guard.ts (canWriteToAdAccount — ownership + token + kill-switch)
2. scan-campaigns: ganti isAllowed → canWriteToAdAccount, hapus env allowlist
3. topup-campaigns: idem + selaraskan interval ke monitorIntervalMinutes
4. Verifikasi strict opt-in filter (automationEnabled/topupEnabled) di kedua cron
5. Default interval 5m di import + PATCH session
6. UI: interval dropdown + teks kontrol
7. /docs + tsc · commit per langkah · push branch feat/multi-tenant-write-cron
```

## Aturan Wajib
- Fail-closed: ragu kepemilikan → JANGAN write. Ownership check WAJIB sebelum tiap Meta write.
- JANGAN scan campaign tanpa automationEnabled=true. Opt-in mutlak.
- Token JANGAN ke log. Skip reason boleh di-log (tanpa token).
- `tokenExpiresAt` — kalau field belum ada di schema, JANGAN bikin migration di sini (overlap gap C). Pakai null-check token dulu.
- No force-push. JANGAN merge — audit Fable dulu. Smoke: campaign opted-out → 0 write; campaign user-lain → skip not_owned.
```
