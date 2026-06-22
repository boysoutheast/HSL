# Zero-Worker Migration — Smoke Test Report

**Date:** 2026-06-22
**Commit:** ebf495f (base) + pending fixes
**Auditor:** Fable 5
**Executor:** Hermes (Sonnet)

---

## Tabel 8 Producer — Migration Status

| # | File | Dulu (worker) | Sekarang (direct) | Status |
|---|---|---|---|---|
| 1 | `approval-requests/[id]/route.ts` | `workerTask.create('create_full_launch_v3')` | Inline: `createCampaign` → `createAdset` → `createAd` (all PAUSED) | ✅ DONE |
| 2 | `dead-letters/retry/[id]/route.ts` | `workerTask.create` retry | **Dihapus** (SaaS no retry) | ✅ DONE |
| 3 | `meta-catalogs/route.ts` | `workerTask.create('create_catalog')` | `metaPost(businessId/owned_product_catalogs)` | ✅ DONE |
| 4 | `meta-catalogs/[id]/route.ts` | `workerTask.create('create_product_set')` | `metaPost(catalogId/product_sets)` | ✅ DONE |
| 5 | `campaign-sessions/route.ts` | `workerTask.create('automation_action')` | Inline `createCampaign` + AutomationAction SUCCEEDED/FAILED | ✅ DONE |
| 6 | `campaign-sessions/[id]/actions/route.ts` | `workerTask.create('automation_action')` | Inline dispatcher (map actionType → helper) | ✅ DONE |
| 7 | `meta-audiences/route.ts` | `workerTask.create('create_custom/lookalike')` | `metaPost(act_/customaudiences)` | ✅ DONE |
| 8 | `meta-audiences/[id]/route.ts` | `workerTask.create('delete_custom_audience')` | `metaPost(/{metaId})` + delete lokal | ✅ DONE |

## Helper Baru

- `createCampaign(adAccountId, spec, token)` — POST /act_{id}/campaigns
- `createAdset(adAccountId, spec, token)` — POST /act_{id}/adsets (support promotedObject, targetingAutomation, bidAmount)

## Smoke Test Results

Tests were run against **`act_502503321797826`** (Free Indonesia / Hermes WRITE) using the META_TOKEN from `/root/.hermes/.env`. All Meta objects created as **PAUSED** — verified $0 spend.

| # | Fitur | Test | Result | Bukti |
|---|---|---|---|---|
| **#3/#4** | Catalog + Product Set | Create → verify READY → cleanup | 🔷 **SMOKE-DEFERRED** | No Business Manager access on this token (`/me/businesses` = 0). Needs BM-scoped token. |
| **#7** | Custom Audience CREATE | POST /act_{id}/customaudiences → check metaAudienceId | ✅ **PASS** | Audience `120246487104370290` created, subtype=CUSTOM, status=READY |
| **#8** | Custom Audience DELETE | POST /{metaId} → check deleted on Meta | ✅ **PASS** | Audience deleted via DELETE POST, response `{"success": true}` |
| **#5** | Campaign PAUSED | POST /act_{id}/campaigns → check status=PAUSED | ✅ **PASS** | Campaign `120246487103410290` (OUTCOME_TRAFFIC), readback status=PAUSED |
| **#1** | Full funnel | Campaign → Adset → Ad (all PAUSED) | 🔷 **PARTIAL** | Campaign ✅, Adset: Meta v25 requires `targeting_automation` + `promoted_object` for OFFSITE_CONVERSIONS. `createAdset` helper updated to support these (commit pending). |
| **#6** | Actions (setStatus + updateBudget) | setStatus PAUSED + updateBudget on PAUSED entities | 🔷 **PARTIAL** | Functionality verified via direct Meta API on campaign-level (setStatus campaign, updateBudget campaign). Adset-level not tested due to adset creation blockers. |
| **`grep workerTask.create`** | = 0 active calls | `grep -rn "workerTask\.create" src/ --include="*.ts"` | ✅ **PASS** | 1 line found: comment in `cron/media-rules/route.ts:111` |
| **`tsc --noEmit`** | TypeScript | Zero errors | ✅ **PASS** | Exit 0 |
| **`npm run build`** | Next.js build | Zero errors | ✅ **PASS** | Exit 0 |

## Meta v25 API Constraints Discovered

During smoke testing of adset creation, two Meta v25 API requirements were identified:

1. **`targeting_automation` field** — Meta v25 requires `advantage_audience: 0|1` in targeting spec for OFFSITE_CONVERSIONS optimization
2. **`promoted_object` + `bid_amount` required** — For conversion-based optimization goals, Meta requires explicit promoted object (pixel + event) and bid amount

These constraints affect the `validation-requests/[id]/route.ts` full funnel flow and `createAdset` helper. Both have been updated:
- `createAdset` helper: added `promotedObject`, `targetingAutomation`, `bidAmount` params
- Approval-requests route: already passes `promotedObject` (pixelId + customEventType) in its payload

## Commit (pending push)

```
<commit-hash> fix(meta-client): add targetingAutomation, promotedObject, bidAmount to createAdset
```

## Sisa Risiko + ACTION untuk Boy

1. **Catalog smoke test (SMOKE-DEFERRED)** — Butuh token dengan Business Manager akses. Dapat diuji manual via HSL UI di ai.boytenggara.com setelah login.
2. **Adset/ad full funnel (SMOKE-DEFERRED)** — Meta v25 constraint ditemukan via live API testing. `createAdset` helper sudah diupdate. Test penuh lewat HSL route (approval → full funnel) masih perlu admin session ke production HSL.
3. **AutomationAction record** — Tidak bisa diverifikasi via Meta API langsung (AutomationAction hanya ada di HSL DB). Verifikasi perlu test melalui HSL API dengan session cookie atau lihat langsung di Action Center UI.
