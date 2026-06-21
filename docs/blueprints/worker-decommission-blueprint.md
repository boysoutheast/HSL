# Blueprint: Worker Decommission — Cleanup End-to-End

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION
**Auditor:** Fable 5 · **Executor:** Sonnet (VPS)
**Estimasi:** 30–45 menit

> Keputusan owner: **Hermes agent worker DIMATIKAN PENUH.** Task-queue async (worker
> protocol) tidak ada consumer lagi. Content agents (Digipro dkk, `isWorker=false`)
> TETAP HIDUP — jangan disentuh. Cron jobs TETAP HIDUP.

---

## ATURAN WAJIB
- Baca tiap file sebelum hapus/edit. Konfirmasi tidak ada importer lain (grep) sebelum hapus lib.
- HANYA hapus yang ada di PHASE 1–3 (confirmed dead). PHASE 4 = VERIFY DULU, jangan hapus blind.
- JANGAN drop tabel/kolom Prisma. JANGAN sentuh `/api/hermes/{library,photos,ceps,content-log,cpas,ready-upload,generated-media,cep-feedback}` (content agent — HIDUP).
- JANGAN hapus `extractBearerToken`, `validateHermesApiKey` di auth.ts (dipakai content agent).
- JANGAN sentuh `/api/cron/*` selain yang disebut PHASE 3.
- `npm run build` + `npx tsc --noEmit` WAJIB lulus tiap akhir phase (selain error pre-existing `driver.js`).
- DILARANG force-push. Commit per phase.
- Ragu = STOP + tulis DEFERRED di report.

---

## PHASE 1 — Hapus worker-protocol endpoints (CONFIRMED DEAD)

Hapus folder/file berikut sepenuhnya:

**Internal worker protocol** (`WORKER_API_KEY`, claim-lease-heartbeat):
```
src/app/api/internal/worker/tasks/route.ts
src/app/api/internal/worker/tasks/claim/route.ts
src/app/api/internal/worker/tasks/[id]/start/route.ts
src/app/api/internal/worker/tasks/[id]/complete/route.ts
src/app/api/internal/worker/tasks/[id]/renew/route.ts
src/app/api/internal/worker/heartbeat/route.ts
src/app/api/internal/worker/events/route.ts
```
→ hapus seluruh folder `src/app/api/internal/worker/`

**Worker agent protocol** (`validateWorkerApiKey` / isWorker):
```
src/app/api/worker/tasks/route.ts
src/app/api/worker/tasks/[id]/route.ts
src/app/api/worker/tokens/[metaConnectionId]/route.ts   ← sekalian matiin leak token Meta
```
→ hapus seluruh folder `src/app/api/worker/`

**Hermes worker task-queue** (consumer isWorker — sudah tidak ada):
```
src/app/api/hermes/tasks/route.ts
src/app/api/hermes/tasks/[id]/route.ts
```
→ hapus folder `src/app/api/hermes/tasks/`
⚠️ HANYA `tasks/` — folder hermes lain (library/photos/ceps/cpas/dll) JANGAN disentuh.

**Commit:** `chore(worker): remove dead worker-protocol endpoints (internal/worker, worker, hermes/tasks)`

---

## PHASE 2 — Hapus SaaS responder + Telegram webhook (driven by worker events)

`saas-responder` cuma dipakai `worker/events` (dihapus PHASE 1) + `webhooks/telegram`. Tanpa worker, thread `waiting_user` tidak pernah dibuat → telegram webhook starved.

Hapus:
```
src/lib/saas-responder.ts
src/app/api/webhooks/telegram/route.ts
```
→ hapus folder `src/app/api/webhooks/telegram/`

**Verify sebelum hapus saas-responder:**
```bash
grep -rn "saas-responder\|runSaasResponder" src/ --include="*.ts"
# Harus 0 setelah worker/events + telegram dihapus. Kalau masih ada importer lain → STOP, DEFERRED.
```

**Catatan model (JANGAN drop):** `ConversationThread`, `ThreadMessage` masih dibaca `admin/threads/*` (admin UI). Biarkan tabel + admin read UI. Cuma producer-nya yang mati.

**Verify `src/lib/telegram.ts` (sendTelegram) masih dipakai:**
```bash
grep -rn "from '@/lib/telegram'\|sendTelegram\|notify.ts" src/ --include="*.ts" | grep -v "saas-responder"
# notify.ts pakai jalur Telegram sendiri → src/lib/telegram.ts kemungkinan MASIH dipakai. JANGAN hapus telegram.ts kalau masih ada importer.
```

**Commit:** `chore(worker): remove saas-responder + telegram webhook (worker-driven, now starved)`

---

## PHASE 3 — Stop orphan producer: cron/media-rules

`src/app/api/cron/media-rules/route.ts:~115` masih `prisma.workerTask.create({ capability:'content_generation', scope:'internal', type:'GENERATE_VIDEO' })`. Tanpa consumer, task numpuk pending selamanya (queue leak).

**Pilihan (default: opsi a):**
- **a. Disable enqueue:** ubah handler jadi no-op untuk bagian create WorkerTask — tetap evaluasi rule + log, TAPI jangan `workerTask.create`. Ganti dengan `console.info('[cron/media-rules] worker decommissioned — enqueue skipped (rule X matched)')` supaya kelihatan di log apa yang TADINYA di-enqueue.
- **b. Hapus total:** kalau media-rules cuma berfungsi nge-feed worker (tidak ada side-effect lain yang berguna), hapus route + minta Boy pause Railway service `cron-media-rules`.

Baca file dulu — kalau ada logic lain yang berguna (mis. update status rule), pertahankan, cuma matikan enqueue-nya. Kalau ragu pilih opsi a (non-destruktif).

**ACTION untuk Boy (tulis di report):** pause/hapus Railway cron service `cron-media-rules` (id `1885b4e2-f974-4b17-a5d3-dd389af1146a`) karena sudah no-op.

**Commit:** `chore(worker): stop cron/media-rules enqueue (no worker consumer)`

---

## PHASE 4 — Orphan code cleanup (setelah PHASE 1–3)

### 4a. `validateWorkerApiKey` di `src/lib/auth.ts`
Setelah PHASE 1, fungsi ini orphan. Verify:
```bash
grep -rn "validateWorkerApiKey" src/ --include="*.ts"
# Harus 0 (selain definisi di auth.ts). Kalau 0 → hapus fungsi validateWorkerApiKey dari auth.ts.
# JANGAN hapus validateHermesApiKey / extractBearerToken / hashApiKey.
```

### 4b. middleware bypass list
`src/middleware.ts` — hapus entri bypass yang sudah tidak ada route-nya:
- `pathname.startsWith('/api/worker/')` → hapus (folder dihapus)
- biarkan `/api/internal/`, `/api/hermes/`, `/api/webhooks/` (masih ada route lain)

### 4c. Import orphan
```bash
npx tsc --noEmit
# Fix import yang nunjuk ke file terhapus (kalau ada).
```

**Commit:** `chore(worker): remove orphan validateWorkerApiKey + middleware bypass`

---

## PHASE 5 — VERIFY-DULU (JANGAN auto-hapus) — internal/* non-worker

Endpoint internal berikut pakai `WORKER_API_KEY` TAPI **bukan worker protocol** — caller eksternalnya TIDAK terlihat di repo (kemungkinan Railway cron service atau infra lain):

```
internal/monitor/metrics/batch, internal/monitor/sessions(+[id])
internal/actions(+[actionId](+/context))
internal/campaign-sessions/[id]/{sync-status,topup-claim}, topup-log(+[id])
internal/rules/{actions,executions}
internal/generated-media/[id](+/refund)
internal/photo-references/batch, internal/media/upload-video
internal/meta-entities/upsert, internal/meta-media/ensure
internal/feature-flags/check
```

**JANGAN hapus.** Untuk tiap endpoint, tulis di report: apakah ada bukti caller (grep src/) — kalau tidak ada caller in-repo, status = "suspect-dead, perlu Boy konfirmasi apakah Railway cron/infra lain masih manggil". Boy yang putuskan nanti, BUKAN auto-delete.

**Catatan:** `WORKER_API_KEY` env JANGAN di-unset — masih dipakai endpoint PHASE 5 ini.

---

## PHASE 6 — Build + Report

```bash
npx prisma generate
npm run build      # WAJIB sukses
npx tsc --noEmit   # clean selain driver.js
```

Buat `docs/worker-decommission-report.md`:
```markdown
# Worker Decommission Report — 2026-06-21
Executor: Sonnet | Auditor target: Fable

## DELETED (Phase 1-2)
| Path | Reason |
|---|---|
| ... | ... |

## ADJUSTED (Phase 3-4)
| File | Change |
|---|---|

## SUSPECT-DEAD — perlu konfirmasi Boy (Phase 5)
| Endpoint | Caller in-repo? | Catatan |
|---|---|---|

## KEPT (sengaja tidak disentuh)
- Content agent endpoints, cron/*, admin UI (worker-tasks/observability/dead-letters/threads), model Prisma, src/lib/telegram.ts (kalau masih dipakai notify)

## ACTION untuk Boy
- Pause Railway cron service: cron-media-rules
- Putuskan nasib endpoint Phase 5 (suspect-dead)
- (opsional) unset WORKER_API_KEY HANYA kalau semua Phase 5 sudah dipastikan dead

## Build/tsc status
```

Kirim ke Boy: tabel DELETED + ADJUSTED + SUSPECT-DEAD + commit hashes + build status.
```
