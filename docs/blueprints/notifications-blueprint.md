# Blueprint E: Notifications — User Tau Apa yang Kejadian

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION (Sonnet)
**Estimasi:** 3–4 jam
**Tujuan:** Saat automation ngapa-ngapain (budget naik, adset di-pause, top-up, pool habis, token mati), user dapet notif. In-app jadi default (scalable 2000 user), Telegram opsional.

---

## 0. Yang sudah ada
`telegram.ts` (`sendTelegram`) + `saas-responder.ts` pakai Telegram per-thread. **Tidak ada** email/in-app notif umum. Telegram butuh chat_id per-user (mayoritas user gak punya) → **in-app = default**, Telegram opt-in.

## 1. Channel
- **In-app (WAJIB, default)**: tabel `Notification` + bell icon di header + halaman/dropdown list. Scalable, gak butuh setup user.
- **Telegram (opsional)**: kalau user isi `telegramChatId` di profil → kirim juga. Reuse `sendTelegram`.
- Email: OUT OF SCOPE (butuh provider — fase lanjut).

## 2. DB — migration
`prisma/migrations/2026XXXX_notifications/` (IF NOT EXISTS, @map, NO DEFAULT cuid()):
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  type        TEXT NOT NULL,        -- rule_fired | write_failed | pool_exhausted | token_expired | topup_created | budget_changed
  severity    TEXT NOT NULL DEFAULT 'info',  -- info | success | warning | error
  title       TEXT NOT NULL,
  body        TEXT,
  ref_type    TEXT,                 -- campaign_session | meta_account | ...
  ref_id      TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON notifications(user_id, read_at);
```
Prisma model `Notification` (camelCase + @map). Relasi ke AdminUser.

## 3. Helper `src/lib/notify.ts`
```ts
export async function notify(userId, { type, severity, title, body, refType?, refId? }) {
  // 1. Insert Notification (in-app)
  // 2. Kalau user.telegramChatId ada → sendTelegram (best-effort, .catch no-crash)
  // De-dupe: jangan spam type+refId sama dalam window (mis. 1 jam) untuk warning berulang.
}
```

## 4. Wiring — trigger dari mana
| Event | Sumber | Notif |
|---|---|---|
| Rule fired (budget/pause) | scan-campaigns saat AutomationAction SUCCEEDED | success "Budget X naik 20%" / "Adset Y di-pause" |
| Write gagal | scan/topup saat action FAILED | error "Gagal update Meta: <alasan>" |
| Top-up bikin ad | topup-campaigns saat CREATE_AD sukses | success "Ad baru ditambah ke campaign X" |
| Pool habis | topup-campaigns skipped_empty_pool | warning "Stok creative habis di campaign X — tambah" |
| Token mati | blueprint C lapis 1/2 saat status→needs_reconnect | error "Akun Meta perlu dihubungkan ulang" |
| Saldo kredit 0 (video) | saat generate ditolak 402 | warning (opsional) |

De-dupe penting buat warning berulang (pool habis tiap tick → 1 notif/jam).

## 5. UI
- **Bell icon** di header (sebelah +Buat): badge angka unread. Klik → dropdown 10 terbaru + "Tandai semua dibaca" + link ke semua.
- Tiap item: ikon severity, title, waktu relatif, klik → ke ref (campaign/connection).
- `GET /api/admin/notifications?unread=&limit=` + `PATCH /api/admin/notifications/read` (mark read, bisa all).
- Polling 60s (atau saat buka dropdown).

## 6. Acceptance
- [ ] Tabel + model Notification (migration IF NOT EXISTS, @map)
- [ ] notify() helper: in-app + Telegram opsional + de-dupe window
- [ ] Wired: rule_fired, write_failed, pool_exhausted, token_expired, topup_created
- [ ] Bell icon + unread badge + dropdown + mark-read
- [ ] Scoped userId (user cuma lihat notif sendiri)
- [ ] De-dupe warning berulang (gak spam)
- [ ] tsc 0 · /docs

## 7. Execution Order
```
1. Migration + model Notification
2. src/lib/notify.ts (in-app + telegram opsional + de-dupe)
3. Wire ke scan/topup/token-check (titik di tabel §4)
4. GET/PATCH notifications endpoint
5. UI bell + dropdown + mark-read
6. /docs + tsc · commit per langkah
```
## Aturan: migration IF NOT EXISTS + @map. Scoped userId. De-dupe wajib. Telegram best-effort no-crash. No force-push.
