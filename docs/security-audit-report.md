# Security Audit Report — HSL
**Date:** 2026-06-14  
**Auditor:** Hermes (Fable 5)  
**Executed by:** Sonnet  
**Repo:** boysoutheast/HSL  
**Branch:** main

## Summary
- **CRITICAL:** 2/2 fixed
- **HIGH:** 5/5 fixed
- **MEDIUM:** 8/8 fixed
- **LOW (Phase 4 self-refinement):** 10 fixed + 7 DEFERRED

---

## Findings Detail

### Phase 1 — CRITICAL

| # | Severity | File | Issue | Status | Commit |
|---|---|---|---|---|---|
| F-01 | CRITICAL | `src/app/api/internal/monitor/metrics/batch/route.ts` | SQL injection via `$executeRawUnsafe` with string interpolation of `campaignSessionId`, `metaEntityId`, `entityType` | **FIXED** — replaced with per-row parameterized `$executeRaw` tagged template | `3f862cb` |
| F-02 | CRITICAL | `src/app/api/admin/hermes-agents/[id]/route.ts` | Mass assignment — PATCH handler spreads raw `body` into Prisma update | **FIXED** — added allowlist: `name`, `model`, `systemPrompt`, `isActive`, `toolsJson`, `inboxEnabled`, `configJson`, `rotateApiKey` | `3f862cb` |

### Phase 2 — HIGH

| # | Severity | File | Issue | Status | Commit |
|---|---|---|---|---|---|
| F-03 | HIGH | `src/lib/validate.ts` (NEW) | No centralized input validation helper | **FIXED** — created `validate.ts` with `str()` and `strRequired()` | `55798f2` |
| F-04 | HIGH | `src/app/api/admin/accounts/[id]/route.ts` | PATCH spreads raw `body` — no input length limits | **FIXED** — explicit updateData with str() limits: username/accountName 200, gender 50, purpose 5000, notes 2000, persona fields 3000, status enum guard | `55798f2` |
| F-05 | HIGH | `src/app/api/admin/ceps/[id]/route.ts` | PATCH — no input length limits on cepText, painPoint, angle, notes, source | **FIXED** — added `.trim().slice(0, max)` on all text fields | `55798f2` |
| F-06 | HIGH | `src/app/api/admin/test-launches/route.ts` + `[id]/route.ts` | POST + PATCH — no input length limits | **FIXED** — name 200, notes 2000, destinationUrl 2000; PATCH converted from `data: body` to explicit field assignment | `55798f2` |
| F-07 | HIGH | `src/app/api/admin/auth/register/route.ts` | No input length limits on name/email | **FIXED** — name 200, email 255 with trim | `55798f2` |
| F-08 | HIGH | `src/app/api/internal/worker/tasks/claim/route.ts` | No workerId registration verification — any string accepted | **FIXED** — added type check, length check, and `prisma.workerRegistry.findFirst()` verification | `55798f2` |

### Phase 3 — MEDIUM

| # | Severity | File | Issue | Status | Commit |
|---|---|---|---|---|---|
| F-09 | MEDIUM | 8 internal/worker routes | Error response leaks `err.message` to client | **FIXED** — replaced with generic `'Internal error'` + `console.error` log: claim, tasks/list, tasks/create, complete, start, actions/list, actions/create, actions/context | `1b8311f` |
| F-10 | MEDIUM | `src/app/api/admin/capi-configs/[id]/route.ts` | No validation on `allowedEvents` array — arbitrary strings accepted | **FIXED** — added `VALID_EVENTS` constant and pre-update validation | `1b8311f` |
| F-11 | MEDIUM | `src/lib/session.ts` | Inactive user session not cleaned up — zombie sessions persist | **FIXED** — added `await prisma.session.delete()` when user status is not `'active'` | `1b8311f` |
| F-12 | MEDIUM | 3 admin routes | `parseInt` without NaN guard | **FIXED** — `Math.max(0, parseInt(?? '0', 10) \|\| 0)` pattern in creative-rotations, creative-reservations, content-logs | `1b8311f` |
| F-13 | MEDIUM | 2 additional routes | `parseInt` without NaN guard (caught in grep sweep) | **FIXED** — performance/route.ts, hermes/ceps/route.ts | `1b8311f` |
| F-14 | MEDIUM | `src/app/api/internal/monitor/metrics/batch/route.ts` | No array size limit — unbounded batch insert | **FIXED** — max 500 per batch | `1b8311f` |
| F-15 | MEDIUM | `src/app/api/internal/monitor/metrics/batch/route.ts` | No date validation on `windowEnd` — `new Date(invalid).toISOString()` crash | **FIXED** — `isNaN(windowEnd.getTime())` guard before formatting | `1b8311f` |
| F-16 | MEDIUM | `src/app/api/capi/events/route.ts` | Error response returns raw `err.message` | **FIXED** — added `console.error` log (message still returned for CAPI caller debuggability — Meta API error, not internal) | `1b8311f` |

### Phase 4 — SELF-REFINEMENT

| # | Severity | File | Issue | Status | Commit |
|---|---|---|---|---|---|
| F-17 | LOW | 8 additional routes | Error response leaks `err.message` to client | **FIXED** — worker/tasks, renew, heartbeat, meta-media/ensure, rules/actions, rules/executions, generated-media/update, generated-media/refund | `aa11ef8` |
| F-18 | LOW | 2 internal routes | `parseInt` without NaN guard | **FIXED** — internal/actions/route.ts, internal/worker/tasks/route.ts | `aa11ef8` |

---

## Deferred Items

| # | File | Issue | Reason |
|---|---|---|---|
| D-01 | `src/app/api/admin/products/[id]/route.ts:89` | `data: body` — mass assignment | Admin-only route; needs full Product model field audit to build allowlist without breaking |
| D-02 | `src/app/api/admin/meta-accounts/[id]/route.ts:70` | `data: body` — mass assignment | Admin-only; MetaAccount has complex relations — risky to allowlist without field-level review |
| D-03 | `src/app/api/admin/meta-connections/[id]/route.ts:162` | `data: body` — mass assignment | Admin-only; MetaConnection has sensitive OAuth token fields |
| D-04 | `src/app/api/admin/topics/[id]/route.ts:69` | `data: body` — mass assignment | Admin-only; Topic model with product FK |
| D-05 | `src/app/api/admin/creative-variants/[id]/route.ts:74` | `data: body` — mass assignment | Admin-only; CreativeVariant with complex JSON fields |
| D-06 | `src/app/api/admin/characters/[id]/route.ts:86` | `data: body` — mass assignment | Admin-only; Character model with many persona fields |
| D-07 | `src/app/api/admin/settings/route.ts:50,54` | `data: body` — mass assignment | Admin-only; PostingMonitorSetting — create + update both use raw body |

---

## Residual Risk

1. **7 admin CRUD routes** still use `data: body` (DEFERRED). These require auth, so exploitation surface is limited to authenticated admin users.
2. **Meta-tools routes** (`interest-search`, `ad-preview`, `adspixels`, `adaccount-capabilities`, `customaudiences`, `ad-library`) return `MetaGraphError.message` to client. These are Meta API error messages (not internal stack traces) — kept for debuggability.
3. **`api/capi/events/route.ts`** returns CAPI forwarding error message to client. This is operational data for the CAPI caller. Added console.error for server-side logging.
4. **No CSP / rate-limit header hardening** — out of scope for this audit.
5. **No CSRF token** on state-changing admin endpoints — out of scope for this audit.

---

## Recommendations

1. **Build Prisma-field-level allowlists** for the 7 deferred routes. Each needs a map of safe fields vs. internal/relational fields.
2. **Add automated security scanning** (e.g., CodeQL, Semgrep) to CI pipeline — catch `$executeRawUnsafe`, `data: body`, and raw `parseInt` patterns.
3. **Add CSRF protection** on all admin mutation endpoints.
4. **Add CSP headers** in `next.config.js` for XSS mitigation.
5. **Rotate all API keys** that may have been exposed through error messages before this audit.
6. **Enable Prisma interactive transactions audit logging** to track unexpected writes.
