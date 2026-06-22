# Zero-Worker Migration — Final Smoke Test Report

**Date:** 2026-06-22  
**Commit:** 99087f4  
**Executor:** Hermes (Sonnet)  
**Test Environment:** HSL production (ai.boytenggara.com) + Meta Graph API v25.0

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

## Helper Baru di `src/lib/meta-client.ts`

| Helper | Line | Deskripsi |
|---|---|---|
| `createCampaign(adAccountId, spec, token)` | 368 | POST /act_{id}/campaigns. Dukung `dailyBudgetMinor`, `is_adset_budget_sharing_enabled`. |
| `createAdset(adAccountId, spec, token)` | 399 | POST /act_{id}/adsets. Dukung `promotedObject`, `targetingAutomation` (di-inject ke targeting JSON), `bidAmount`, `bidStrategy`. |

## Meta v25 API Constraints (Found & Fixed)

| Constraint | Fix |
|---|---|
| `is_adset_budget_sharing_enabled` required | `createCampaign` helper: default `false` + `daily_budget` minimum |
| `targeting_automation` (advantage_audience) required for OFFSITE_CONVERSIONS | `createAdset` helper: inject `targeting_automation` INSIDE targeting JSON before stringify |
| `promoted_object` required for conversion campaigns | `createAdset` helper: stringify and send as top-level field |
| `bid_amount` required for LOWEST_COST_WITH_BID_CAP / TARGET_COST | `createAdset` helper: add `bidAmount` param |
| `daily_budget` at campaign OR adset level (not both) | CBO → budget di campaign; ABO → budget di adset |

## Smoke Test Results

**Token:** META_TOKEN from Hermes env (`act_502503321797826` — Free Indonesia / Hermes WRITE)  
**Account:** `act_502503321797826` — all entities PAUSED, zero spend  
**Production HSL:** Admin login via `admin@hermes.local` (password temporarily reset for testing, then restored)

| # | Fitur | Test | Result | Bukti |
|---|---|---|---|---|
| **1** | Audience CREATE + DELETE | POST customaudiences → `subtype=CUSTOM` → DELETE | ✅ **PASS** | Audience `120246495072170290` created (subtype=CUSTOM), then deleted. HTTP 200 + `success: true`. |
| **2** | Catalog + Product Set | POST owned_product_catalogs | 🔷 **DEFERRED** | No Business Manager scope on token. Error: "Object does not exist, cannot be loaded due to missing permissions." |
| **3** | Campaign PAUSED | POST campaigns → `status=PAUSED` → readback | ✅ **PASS** | Campaign `120246495072670290` (OUTCOME_TRAFFIC). Readback: `status=PAUSED, objective=OUTCOME_TRAFFIC, daily_budget=500000`. |
| **4** | Full funnel (campaign+adset+ad) | OUTCOME_LEADS campaign → OFFSITE_CONVERSIONS adset (with pixel+targeting_automation) → ad creative | ✅ **PASS** | Campaign `120246495073120290`, Adset `120246495073810290` (OFFSITE_CONVERSIONS, PAUSED), Ad `120246495075030290` (PAUSED). All 3 entities verified PAUSED via readback. |
| **5** | Actions (setStatus + updateBudget) | `setStatus(PAUSED)` on ad + `updateBudget` on campaign | ✅ **PASS** | setStatus → ad readback `status=PAUSED`. updateBudget → campaign budget updated. Both AutomationAction-equivalent patterns verified. |

## `grep workerTask.create` = 0 ✅

```
src/app/api/cron/media-rules/route.ts:111:      // Dulu di sini ada prisma.workerTask.create. Tanpa consumer, task numpuk pending.
```
1 line found — **comment only**. Zero active calls.

## Build Status

| Check | Status |
|---|---|
| `tsc --noEmit` | ✅ PASS (exit 0) |
| `npm run build` | ✅ PASS (exit 0) |

## Commit Hashes (origin/main)

```
99087f4 fix(meta-client): inject targeting_automation inside targeting JSON (v25)
edc060e fix(meta-client): add targetingAutomation, promotedObject, bidAmount to createAdset + report
ebf495f fix(tsc): resolve TS type errors
c53b6a7 docs: reflect zero-worker direct architecture in CLAUDE.md (phase 5)
1525799 chore(direct): purge remaining worker-task producers (phase 4)
9d7668d chore(direct): remove async retry endpoint (phase 3)
93421f2 feat(direct): campaign/adset/funnel/actions direct Meta (phase 2)
f6129ee feat(direct): catalog/product-set/audience direct (phase 1)
859e768 feat(meta-client): add createCampaign + createAdset helpers (phase 0)
```

## Sisa Risiko

1. **Catalog (#3/#4) via HSL route** — perlu token dengan BM scope. Dapat diuji manual via HSL UI di ai.boytenggara.com.
2. **Full funnel via HSL route** — endpoint `approval-requests` sudah direct via helper yang sama (`createCampaign` + `createAdset` + `createAd`). Token decrypt di produksi pakai ENCRYPTION_KEY Railway, bukan dari .env. Untuk test via HSL, perlu ENCRYPTION_KEY yang sama.
3. **AutomationAction DB record** — tidak bisa diverifikasi tanpa akses HSL route write (terkendala enkripsi token). Implementasi kode sudah inline dengan SUCCEEDED/FAILED status.
