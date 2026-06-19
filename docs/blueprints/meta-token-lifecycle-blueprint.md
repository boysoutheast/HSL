# Blueprint C: Meta Token Lifecycle — Anti Silent-Death

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION (Sonnet)
**Estimasi:** 2–3 jam · NO migration (field udah ada) · Kritikal buat 2000 user
**Tujuan:** Token Meta expire 60 hari. Cegah "campaign berhenti dioptimasi diam-diam" — deteksi token mati, tandai akun, suruh user reconnect, skip write yang gak valid.

---

## 0. Yang SUDAH ADA (jangan bikin ulang)
`MetaAccount`: `tokenExpiry`, `status` (connected|expired|needs_reconnect|revoked), `lastTokenCheckAt`, `longLivedTokenEncrypted`. Cron `check-meta-tokens` SUDAH ADA (`src/app/api/cron/check-meta-tokens`) — cek isinya dulu, mungkin tinggal dilengkapin. **NO migration.**

## 1. Masalah
- Token long-lived Meta = 60 hari. Di 2000 user → ratusan expire tiap bulan.
- Kalau gak dideteksi: cron scan/topup manggil Meta dgn token mati → error 190 → write gagal → **user gak tau campaign-nya berhenti dioptimasi.** Silent killer.

## 2. Tiga lapis pertahanan

### Lapis 1 — Proactive check (cron `check-meta-tokens`)
Lengkapin cron yang udah ada:
```
Tiap 6 jam (atau harian):
  Per MetaAccount status='connected':
    1. GET /me atau debug_token → cek valid + expiry
    2. Update tokenExpiry, lastTokenCheckAt
    3. Kalau < 7 hari ke expiry → status tetap connected TAPI flag "expiring_soon" (notif gap E)
    4. Kalau invalid (error 190) → status='needs_reconnect'
    5. Kalau expired → status='expired'
```

### Lapis 2 — Reactive (saat write/scan kena error 190)
Di `meta-client.ts` (TokenError udah ada): kalau Meta balikin code 190 / OAuthException saat scan/topup:
```
→ set MetaAccount.status='needs_reconnect'
→ skip session ini (jangan retry buta)
→ trigger notif user (gap E)
→ write-guard (blueprint A) otomatis skip akun status != 'connected' di tick berikut
```

### Lapis 3 — Recovery (user reconnect)
- UI banner: akun Meta `needs_reconnect`/`expired` → tombol **"Hubungkan ulang Meta"** → OAuth flow (udah ada `/api/admin/meta-oauth/start`).
- Sukses reconnect → token baru, `tokenExpiry` di-refresh, `status='connected'`. Campaign langsung jalan lagi (write-guard lolos).

## 3. UI/UX
- **System → Connections**: tiap akun Meta tampil status pill: 🟢 Terhubung · 🟡 Segera expire (X hari) · 🔴 Perlu reconnect. Tombol reconnect kalau merah/kuning.
- **Dashboard / campaign detail**: kalau campaign automationEnabled tapi token akunnya mati → banner merah "Automation berhenti — token Meta expired. [Hubungkan ulang]". Biar user GAK BINGUNG kenapa campaign diam.
- Admin Overview: KPI "akun Meta perlu reconnect: N" (alert).

## 4. Acceptance
- [ ] cron check-meta-tokens: update tokenExpiry/status/lastTokenCheckAt, deteksi expiring_soon + invalid
- [ ] meta-client: error 190 saat scan/topup → set status='needs_reconnect' + skip (gak retry buta)
- [ ] write-guard skip akun status != 'connected' (udah di blueprint A — verifikasi nyambung)
- [ ] UI Connections: status pill + tombol reconnect; reconnect refresh token + status connected
- [ ] Banner di campaign/dashboard kalau token mati + automation ON
- [ ] Admin Overview: count akun perlu reconnect
- [ ] Notif user saat status berubah ke needs_reconnect/expired (gap E)
- [ ] tsc 0 · /docs

## 5. Execution Order
```
1. Cek + lengkapi cron check-meta-tokens (debug_token, update status/expiry)
2. meta-client: handle 190 → set needs_reconnect + skip
3. UI Connections: status pill + reconnect button
4. Banner campaign/dashboard (automation ON + token mati)
5. Admin Overview KPI reconnect-needed
6. Wire notif (gap E) saat status berubah
7. /docs + tsc · commit per langkah
```
## Aturan: NO migration (field ada). Token jgn ke log. Fail-closed: token ragu → skip write. No force-push.
