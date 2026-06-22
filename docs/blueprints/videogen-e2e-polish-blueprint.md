# Video Gen E2E Polish — Blueprint

**Scope:** Dokumentasi API lengkap + hardening polling pipeline untuk Hermes agent

---

## Masalah yang Ditemukan

1. **Docs tidak lengkap** — Hermes tidak tahu flow normal/best/worst case, tidak tahu kapan refund terjadi
2. **`refundedAt` tidak dikirim** — GET /api/gen/video/:id tidak include field ini, Hermes tidak bisa konfirmasi refund
3. **MAX_CONCURRENT = 5** — kalau ada > 5 jobs stuck, cron harus 2x jalan untuk bersihin semua
4. **Webhook belum terverifikasi** — GeminiGen bisa kirim webhook tapi perlu dikonfirmasi di dashboard GeminiGen
5. **errorMessage generic** — timeout error tidak bilang "credits sudah direfund"

---

## Yang Harus Dikerjakan

### 1. GET /api/gen/video/:id — tambah `refundedAt`

File: `src/app/api/gen/video/[id]/route.ts`

Tambah `refundedAt` ke select:
```ts
select: {
  // ... existing fields
  refundedAt: true,   // ← tambah ini
}
```

Response shape Hermes jadi:
```json
{
  "id": "...",
  "status": "failed",
  "errorMessage": "Timeout: job exceeded 20 minutes — credits auto-refunded",
  "creditsCost": 1300,
  "refundedAt": "2026-06-15T06:00:00.000Z",   // non-null = sudah direfund
  ...
}
```

### 2. GET /api/gen/video (list) — tambah `refundedAt`

File: `src/app/api/gen/video/route.ts`

Sama — tambah `refundedAt: true` ke select block.

### 3. Cron: MAX_CONCURRENT 5 → 10 + error message lebih jelas

File: `src/app/api/cron/poll-geminigen/route.ts`

```ts
const MAX_CONCURRENT = 10   // dari 5

// Error message saat timeout:
errorMessage: `Timeout: job exceeded ${TIMEOUT_MINUTES} minutes — credits auto-refunded`,
// (bukan hanya "Timeout: job exceeded 20 minutes")

// Error message saat GeminiGen failed:
errorMessage: 'GeminiGen generation failed — credits auto-refunded',
```

### 4. Docs — ConnectionsTab.tsx

File: `src/app/system/ConnectionsTab.tsx`

Tambah section baru setelah "API Gen Endpoints" dan sebelum "Error Codes":

**Section: "⏱ Flow & Timing"**

```
Normal Flow (30s–5 min):
  POST /api/gen/video → 201 { id, creditsCost, balanceAfter }
    ↓ (simpan id)
  Poll GET /api/gen/video/{id} setiap 30s
    status: queued → processing → completed
    ↓ completed
  Download videoUrl

Best Case (~40s):
  Submit → GeminiGen webhook masuk → langsung completed

Worst Case (~20 menit):
  Submit → GeminiGen tidak respond / error → cron timeout → status=failed
  refundedAt terisi → credits sudah dikembalikan otomatis
  → Resubmit dengan prompt + foto yang sama
```

**Polling recommendation:**
- Interval: 30 detik
- Timeout: berhenti setelah 25 menit (lebih dari TIMEOUT_MINUTES cron)
- Cek `refundedAt` saat status=failed → kalau non-null, aman resubmit

**Table: Status Lifecycle**

| Status | Artinya | Action Hermes |
|---|---|---|
| queued | Job diterima, belum ke GeminiGen | Tunggu |
| processing | Di GeminiGen, sedang diproses | Poll terus tiap 30s |
| completed | Video siap | Download videoUrl |
| failed | Gagal / timeout | Cek refundedAt → resubmit |

**Section: "🔄 Refund Policy"**
- Refund otomatis saat: GeminiGen failed (status=3), atau timeout 20 menit
- Cek via `refundedAt` field di response — non-null = credits sudah kembali
- Idempotent — tidak bisa double refund
- Cek balance via GET /api/gen/credits setelah refund

### 5. Webhook Verification Note (docs saja, bukan code)

Tambah di ConnectionsTab atau runbook:
```
Webhook: https://ai.boytenggara.com/api/webhooks/geminigen
Secret: OPTIONAL (GeminiGen tidak selalu kirim x-geminigen-secret)
Kalau webhook aktif → completed dalam ~40s
Kalau webhook tidak aktif → cron backup setiap 5 menit
```

Pastikan di GeminiGen dashboard (https://geminigen.ai/profile/integration/webhook) URL sudah diset.

---

## Yang TIDAK Perlu Diubah

- Schema Prisma — `refundedAt` sudah ada
- Auth system — `requireApiKey` sudah benar
- Webhook handler — sudah aman dan idempotent
- `TIMEOUT_MINUTES = 20` — sudah tepat untuk GeminiGen (2-5 menit normal)
- `refundCredits()` — sudah idempotent via `refundedAt` lock

---

## Urutan Eksekusi

1. Edit `route.ts` [id] → tambah `refundedAt`
2. Edit `route.ts` list → tambah `refundedAt`  
3. Edit cron → `MAX_CONCURRENT = 10`, improve error messages
4. Edit `ConnectionsTab.tsx` → tambah Flow & Timing section + Refund Policy
5. git add + commit + push
6. Verify: curl GET /api/gen/video/[any-failed-id] → cek `refundedAt` ada di response

---

## Verify Checklist

- [ ] `refundedAt` muncul di GET /api/gen/video/:id response
- [ ] `refundedAt` muncul di GET /api/gen/video list items
- [ ] `errorMessage` saat timeout bilang "credits auto-refunded"
- [ ] ConnectionsTab di System → Connections punya section Flow & Timing
- [ ] Build tidak error (`npm run build` atau Railway deploy success)
