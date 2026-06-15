# Sonnet Task: Video Gen Correlation ID

**Blueprint:** `docs/blueprints/videogen-correlation-id-blueprint.md` — baca dulu.

**Goal:** Tambah field `clientRef` ke video generation pipeline supaya Hermes bisa anchor 1 job ke 1 creative slot tanpa tergantung memori internal.

---

## Environment

```
Working dir: /Users/siscaliman/Documents/Claude/Projects/Hermes Infrastructure/hermes-support-web
Stack: Next.js 14, Prisma, PostgreSQL (Railway)
Deploy: git push origin main → Railway auto-deploy
```

---

## Steps

### Step 1 — Schema

Edit `prisma/schema.prisma`:

Dalam `model GeneratedMedia`, tambah setelah field `source`:
```prisma
clientRef   String?   @map("client_ref")
```

Dalam `model GeneratedMedia`, tambah ke `@@index` atau buat baru:
```prisma
@@index([userId, clientRef])
```

### Step 2 — Migration

```bash
railway run -- npx prisma migrate dev --name add_client_ref_to_generated_media
railway run -- npx prisma generate
```

Kalau migrate dev tidak bisa di production, buat migration manual:
```bash
railway run -- npx prisma migrate deploy
```

### Step 3 — POST route

Edit `src/app/api/gen/video/route.ts`:

Di bagian form parsing (setelah `durationSeconds`), tambah:
```ts
const clientRef = (form.get('clientRef') as string | null)?.trim().slice(0, 200) ?? null
```

Di `prisma.generatedMedia.create` → `data: { ... }`, tambah:
```ts
clientRef: clientRef ?? null,
```

### Step 4 — GET /:id route

Edit `src/app/api/gen/video/[id]/route.ts`:

Di `select: { ... }`, tambah:
```ts
clientRef: true,
```

### Step 5 — GET list route

Edit `src/app/api/gen/video/route.ts` (GET handler):

Setelah parsing `offset`, tambah:
```ts
const clientRef = searchParams.get('clientRef') ?? null
```

Ganti `const where = { userId: user.id }` menjadi:
```ts
const where: Record<string, unknown> = { userId: user.id }
if (clientRef) where.clientRef = clientRef
```

Di `prisma.generatedMedia.findMany` → `select: { ... }`, tambah:
```ts
clientRef: true,
```

### Step 6 — Docs

Edit `src/app/system/ConnectionsTab.tsx`:

Di tabel request body POST /api/gen/video (array `reqFields` untuk POST), tambah row:
```ts
['clientRef', 'string', '—', 'Referensi caller unik per slot (e.g. "ad-3-rahasia-123"). Max 200 char. Dikembalikan di poll.'],
```

Di tabel response GET /api/gen/video/:id (array `respFields`), tambah row:
```ts
['clientRef', 'string|null', 'Referensi yang di-set saat submit — pakai untuk mapping parallel jobs'],
```

### Step 7 — Build & Push

```bash
npm run build
git add prisma/schema.prisma prisma/migrations/ src/app/api/gen/video/route.ts src/app/api/gen/video/[id]/route.ts src/app/system/ConnectionsTab.tsx
git commit -m "feat: add clientRef to video gen for parallel job tracking"
git push origin main
```

---

## Verify

```bash
# Test submit dengan clientRef
curl -X POST https://ai.boytenggara.com/api/gen/video \
  -H "x-api-key: YOUR_KEY" \
  -F "prompt=test" \
  -F "clientRef=test-slot-1" \
  -F "file=@test.jpg"

# Test poll by job ID → cek clientRef ada
curl https://ai.boytenggara.com/api/gen/video/{id} \
  -H "x-api-key: YOUR_KEY"

# Test filter by clientRef
curl "https://ai.boytenggara.com/api/gen/video?clientRef=test-slot-1" \
  -H "x-api-key: YOUR_KEY"
```

Expected: semua response include `clientRef: "test-slot-1"`.

---

## Kirim Report

Setelah selesai, kirim SONNET REPORT dengan:
- File yang diubah
- Migration yang dijalankan
- Output `npm run build` (sukses / ada error apa)
- Hasil 3 curl verify di atas
