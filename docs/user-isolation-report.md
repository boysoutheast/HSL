# User Isolation Report — HSL
Date: 2026-06-15 | Auditor: Fable 5 | Executor: Sonnet

## Admin Routes
Grade: A — not audited in this pass, out of scope.

## Findings

| # | File | Issue | Status | Notes |
|---|---|---|---|---|
| 1 | `gen/media/[id]/route.ts` | Auth mismatch (Hermes vs user key) | **FIXED** | `validateHermesApiKey` → `requireApiKey`, filter `user.id` |
| 2 | `gen/media/[id]/download/route.ts` | Sama | **FIXED** | Same switch + null guard |
| 3 | `photos/upload/route.ts` | No ownership check on characterId/topicId/productId/instagramAccountId | **FIXED** | 4 ownership checks via `createdByUserId` chain |
| 4 | `internal/actions/route.ts` | Worker endpoint — no session validation, no userId validation, no audit log | **HARDENED** | GET: campaignSessionId validation + audit log. POST: userId validation + audit log. Limit already defaulted (line 23). |
| 5 | `hermes/tasks/[id]/route.ts` | No payload.userId validation before MediaAsset create | **FIXED** | `prisma.adminUser.findUnique` guard added |

## E2E Wiring

| Flow | Status | Verified |
|---|---|---|
| GET `/api/gen/video/[id]` → mediaHash | **ALREADY EXPOSED** | Line 34-35: `mediaHash: true, mediaHashRevokedAt: true` in Prisma select |
| GET `/api/gen/credits` → txHash | **ALREADY EXPOSED** | Line 25: `txHash: true` in Prisma select |

Note: Both were added during hash-receipt implementation (commit `41f19f9`). No new changes needed.

## Deferred

- STEP 5 was truncated in original message; Boy provided it in follow-up prompt.
- No legitimate Hermes caller found for `gen/media` endpoints (grep confirmed 0 results).
- Schema field names matched blueprint assumptions — no DEFERRED from schema mismatch.
- `/api/hermes/cpas/*` intentionally keeps `validateHermesApiKey` (by design).

## Commits

| Phase | Commit | Files |
|---|---|---|
| Phase 1 (partial) | `e3ec0e8` | `gen/media/[id]/route.ts`, `gen/media/[id]/download/route.ts`, `photos/upload/route.ts`, `internal/actions/route.ts` |
| Phase 1 (STEP 5) | `69cc16b` | `hermes/tasks/[id]/route.ts` — payload.userId guard |
| Phase 2 | Skipped | mediaHash/txHash already exposed in hash-receipt work |
| Worker isolation (earlier) | `9c61e31` | `hermes/tasks/route.ts`, `hermes/tasks/[id]/route.ts` — validateWorkerApiKey |

## tsc Status

- `e3ec0e8`: clean (0 errors)
- `69cc16b`: clean (0 errors)
- Final: clean
