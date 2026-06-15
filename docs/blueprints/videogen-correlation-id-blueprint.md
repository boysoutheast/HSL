# Video Gen Correlation ID — Blueprint

**Problem:** Hermes run 5 jobs parallel → saat poll, mapping result ke creative slot bisa salah karena tidak ada anchor dari submit ke poll ke Meta upload.

**Goal:** 1 ID yang sama dipakai dari submit → poll → download → Meta upload → audit. Hermes tidak perlu "ingat" mapping di memori — HSL yang simpan.

---

## Perubahan yang Dibutuhkan

### 1. Schema — tambah `clientRef` ke `GeneratedMedia`

File: `prisma/schema.prisma`

```prisma
model GeneratedMedia {
  // ... existing fields
  clientRef   String?   @map("client_ref")   // caller-provided reference, e.g. "ad-3-rahasia-1781516633"
  // ...
  @@index([userId, clientRef])   // tambah index
}
```

Migration baru:
```sql
ALTER TABLE generated_media ADD COLUMN client_ref TEXT;
CREATE INDEX idx_generated_media_client_ref ON generated_media(user_id, client_ref);
```

### 2. POST /api/gen/video — terima `clientRef`

File: `src/app/api/gen/video/route.ts`

Tambah di form parsing:
```ts
const clientRef = (form.get('clientRef') as string | null)?.trim().slice(0, 200) ?? null
```

Tambah ke `prisma.generatedMedia.create`:
```ts
data: {
  // ...existing
  clientRef: clientRef ?? null,
}
```

Response tetap sama (tidak perlu return clientRef — sudah bisa di-lookup via GET).

### 3. GET /api/gen/video/:id — return `clientRef`

File: `src/app/api/gen/video/[id]/route.ts`

Tambah ke select:
```ts
clientRef: true,
```

### 4. GET /api/gen/video (list) — support filter by `clientRef` + return field

File: `src/app/api/gen/video/route.ts`

Tambah query param:
```ts
const clientRef = searchParams.get('clientRef') ?? null

const where = {
  userId: user.id,
  ...(clientRef ? { clientRef } : {}),
}
```

Tambah ke select:
```ts
clientRef: true,
```

Response item sekarang include `clientRef`.

### 5. Docs — ConnectionsTab.tsx

Tambah ke tabel request body POST /api/gen/video:
```
clientRef | string | — | Referensi caller (e.g. "ad-3-rahasia-campaign-123"). Dikembalikan di poll response. Max 200 char.
```

Tambah ke response GET /api/gen/video/:id:
```
clientRef | string|null | Referensi yang di-set saat submit
```

Tambah note di Flow & Timing section:
```
Parallel jobs: selalu set clientRef unik per slot saat submit.
Poll by clientRef: GET /api/gen/video?clientRef=ad-3-rahasia-campaign-123
Satu clientRef = satu slot creative = tidak bisa salah assign.
```

---

## Cara Hermes Pakai (setelah fix)

```
Submit:
POST /api/gen/video
  clientRef: "digipro-1781516633-rahasia-ad-3"
  prompt: "..."
  file: <image>
→ Response: { id: "cmqf12t0b0", clientRef: "digipro-1781516633-rahasia-ad-3", ... }

Poll:
GET /api/gen/video/cmqf12t0b0
→ { id, clientRef: "digipro-1781516633-rahasia-ad-3", status, videoUrl, ... }

ATAU query by clientRef:
GET /api/gen/video?clientRef=digipro-1781516633-rahasia-ad-3
→ { items: [{ id, status, videoUrl, clientRef, ... }] }

Saat completed:
- Download videoUrl
- Upload ke Meta
- Map ke creative berdasarkan clientRef — tidak perlu ingat ID mapping di memori Hermes
```

---

## Yang TIDAK Perlu Diubah

- Schema credit/refund — tetap pakai HSL job ID
- Auth — tidak berubah
- GeminiGen integration — tidak berubah
- Cron — tidak berubah
- `refundedAt`, `creditsCost`, dll — tidak berubah

---

## Urutan Eksekusi Sonnet

1. Edit `prisma/schema.prisma` — tambah `clientRef String? @map("client_ref")` + index
2. Jalankan `npx prisma migrate dev --name add_client_ref` (dev) atau buat migration SQL manual
3. Jalankan `npx prisma generate`
4. Edit `src/app/api/gen/video/route.ts` — POST terima `clientRef`, GET list filter + return
5. Edit `src/app/api/gen/video/[id]/route.ts` — GET return `clientRef`
6. Edit `src/app/system/ConnectionsTab.tsx` — update docs
7. `npm run build` — pastikan tidak ada type error
8. `git add + commit + push`

---

## Verify Checklist

- [ ] POST /api/gen/video dengan `clientRef: "test-123"` → response include `id`
- [ ] GET /api/gen/video/{id} → response include `clientRef: "test-123"`
- [ ] GET /api/gen/video?clientRef=test-123 → return job tersebut
- [ ] GET /api/gen/video tanpa clientRef filter → return semua job user (tidak terfilter)
- [ ] `npm run build` sukses tanpa error
- [ ] Railway deploy sukses
