# Worker Isolation Report

**Commit:** `9c61e31`
**Blueprint:** `docs/blueprints/worker-isolation-blueprint.md` (not found in repo — instructions from user)
**Date:** 2026-06-15

## Files Changed

| File | Change |
|---|---|
| `src/app/api/hermes/tasks/route.ts` | `validateHermesApiKey` → `validateWorkerApiKey` (import + GET + POST handler). Error message: `'Invalid or inactive API key'` → `'Unauthorized — worker key required'` |
| `src/app/api/hermes/tasks/[id]/route.ts` | `validateHermesApiKey` → `validateWorkerApiKey` (import + POST handler). Same error message change. |

## STEP 3 — Self-Refinement Grep

```
grep -rn "validateHermesApiKey" src/app/api/hermes/tasks/ --include="*.ts"
# Result: 0 matches — PASS

grep -rn "validateWorkerApiKey" src/app/api/hermes/tasks/ --include="*.ts"
# Result: 5 matches across both files (1 import each + 2 handlers in route.ts + 1 in [id]/route.ts) — PASS
```

## STEP 4 — Broad Check

```
grep -rn "validateHermesApiKey" src/app/api/hermes/ --include="*.ts"
```

All remaining `validateHermesApiKey` usages are in non-task files:
- `cep-feedback/`, `photos/`, `ready-upload/`, `cpas/*` (pain-library, diary, spawn-job, graveyard, slot-count, lessons), `ceps/*`, `library/`, `content-log/`

**Verdict:** No leaks — `tasks/*` is fully `validateWorkerApiKey`, other Hermes endpoints correctly remain `validateHermesApiKey`. CPAS endpoints intentionally keep `validateHermesApiKey` per design.

## STEP 5 — tsc

```
npx tsc --noEmit
# Result: exit 0, zero errors — PASS
```

## Unchanged (per hard rules)

- `src/app/api/hermes/cpas/` — untouched (intentional design)
- `/api/worker/*` — already safe, untouched

## Deviations

None.

## Status

DONE — worker task queue now isolated from content agents. Only API keys with `isWorker=true` can list/claim/update worker tasks.
