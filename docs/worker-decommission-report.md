# Worker Decommission Report — 2026-06-21

**Executor:** Sonnet (VPS)  
**Auditor target:** Fable 5  
**Repo:** boysoutheast/HSL  
**Branch:** main

---

## DELETED (Phase 1–2)

| Path | Reason |
|---|---|
| `src/app/api/internal/worker/events/route.ts` | Worker protocol — no consumer |
| `src/app/api/internal/worker/heartbeat/route.ts` | Worker protocol — no consumer |
| `src/app/api/internal/worker/tasks/route.ts` | Worker protocol — no consumer |
| `src/app/api/internal/worker/tasks/claim/route.ts` | Worker protocol — no consumer |
| `src/app/api/internal/worker/tasks/[id]/start/route.ts` | Worker protocol — no consumer |
| `src/app/api/internal/worker/tasks/[id]/complete/route.ts` | Worker protocol — no consumer |
| `src/app/api/internal/worker/tasks/[id]/renew/route.ts` | Worker protocol — no consumer |
| `src/app/api/worker/tasks/route.ts` | Worker agent protocol — no consumer |
| `src/app/api/worker/tasks/[id]/route.ts` | Worker agent protocol — no consumer |
| `src/app/api/worker/tokens/[metaConnectionId]/route.ts` | Worker agent — sekalian matiin leak token Meta |
| `src/app/api/hermes/tasks/route.ts` | Hermes task-queue — isWorker consumer mati |
| `src/app/api/hermes/tasks/[id]/route.ts` | Hermes task-queue — isWorker consumer mati |
| `src/lib/saas-responder.ts` | Hanya dipakai worker/events + telegram webhook |
| `src/app/api/webhooks/telegram/route.ts` | Starved — thread waiting_user tidak pernah dibuat tanpa worker |

## ADJUSTED (Phase 3–4)

| File | Change |
|---|---|
| `src/app/api/cron/media-rules/route.ts` | Enqueue (`workerTask.create`) diganti `console.info` — evaluasi rule + dedup tetap jalan |
| `src/lib/auth.ts` | Hapus fungsi `validateWorkerApiKey` (orphan setelah PHASE 1) |
| `src/middleware.ts` | Hapus bypass `pathname.startsWith('/api/worker/')` |

## SUSPECT-DEAD — perlu konfirmasi Boy (Phase 5)

Semua endpoint berikut pakai `WORKER_API_KEY` / auth internal, tapi **tidak ada caller in-repo** (grep src/ → 0 selain definisi sendiri).

| Endpoint | Caller in-repo? | Catatan |
|---|---|---|
| `internal/monitor/metrics/batch` | ✗ 0 | Mungkin Railway cron |
| `internal/monitor/sessions (+[id])` | ✗ 0 | Mungkin Railway cron |
| `internal/actions (+[actionId], +/context)` | ✗ 0 | Mungkin automation cron |
| `internal/campaign-sessions/[id]/sync-status` | ✗ 0 | Mungkin sync-campaigns cron |
| `internal/campaign-sessions/[id]/topup-claim` | ✗ 0 | Mungkin topup-campaigns cron |
| `internal/campaign-sessions/topup-log (+[id])` | ✗ 0 | Mungkin topup-campaigns cron |
| `internal/rules/actions` | ✗ 0 | Mungkin automation cron |
| `internal/rules/executions` | ✗ 0 | Mungkin automation cron |
| `internal/generated-media/[id] (+/refund)` | ✗ 0 | Mungkin external service |
| `internal/media/upload-video` | ✗ 0 | Mungkin external service |
| `internal/meta-entities/upsert` | ✗ 0 | Mungkin sync-campaigns cron |
| `internal/meta-media/ensure` | ✗ 0 | Mungkin external service |
| `internal/photo-references/batch` | ✗ 0 | Mungkin external service |
| `internal/feature-flags/check` | ✗ 0 | Mungkin external service |

**⚠️ JANGAN hapus** tanpa konfirmasi Boy. Semua tetap hidup, `WORKER_API_KEY` env JANGAN di-unset.

## KEPT (sengaja tidak disentuh)

- **Content agent endpoints:** `/api/hermes/{library,photos,ceps,cpas,content-log,ready-upload,generated-media,cep-feedback}`
- **Cron jobs** (selain media-rules enqueue): semua tetap hidup
- **Admin UI:** worker-tasks, observability, dead-letters, threads — baca live
- **Model Prisma:** semua tabel (ConversationThread, ThreadMessage, WorkerTask dll) — JANGAN di-drop
- **`src/lib/telegram.ts`:** masih dipakai `notify.ts` → dibiarkan

## ACTION untuk Boy

| # | Action |
|---|---|
| 1 | **Pause Railway cron service:** `cron-media-rules` (id `1885b4e2-f974-4b17-a5d3-dd389af1146a`) — sudah no-op, hanya log |
| 2 | **Putuskan nasib 14 endpoint Phase 5** (suspect-dead) — konfirmasi apakah Railway cron/infra lain masih manggil |
| 3 | **Unset `WORKER_API_KEY`** HANYA kalau semua Phase 5 sudah dipastikan dead |

## Commit Hashes

| Phase | Hash | Description |
|---|---|---|
| 1–2 | `0927291` | Remove dead worker-protocol endpoints (14 file deletions) |
| 3–4 | `8afe048` | Disable cron/media-rules enqueue + remove orphan validateWorkerApiKey + middleware bypass |

Push: `ce861de..0927291 main → main`

## Build / tsc status

| Check | Status |
|---|---|
| `npx prisma generate` | ✅ Success |
| `npm run build` | ✅ **Compiled successfully** — 0 error |
| `npx tsc --noEmit` | ✅ **Clean** (selain `driver.js` di `useTour.ts` pre-existing) |
