# Hermes with UI — End Game Vision

> **Core thesis:** Semua kesulitan infra (Meta API, placement logic, audience building, media generation, multi-account ops) bisa ditabrak dari satu web UI — karena ada Hermes sebagai execution engine di belakangnya.

---

## 1. Konsep: Mini-Agentic per Fungsi

Setiap halaman fungsional di HSL punya **agent capsule** — komponen UI yang bisa diaktifkan untuk menjalankan task kompleks lewat bahasa natural, dengan konteks halaman itu sebagai scope-nya.

```
[ Campaign Monitor ]       [ Ad Account Manager ]      [ Media Library ]
  [Wait your command ▼]     [Wait your command ▼]       [Wait your command ▼]
  ↓ klik                    ↓ klik                       ↓ klik
  Text prompt box           Text prompt box              Text prompt box
  + Response area           + Response area              + Response area
  (scope: campaign data     (scope: all accounts)        (scope: media assets)
   di halaman ini)
```

Agent di tiap capsule hanya punya akses ke scope yang relevan — campaign monitor agent gak bisa langsung ngubah billing.

---

## 2. Contoh Flow: Auto-Rule Builder

**User mengetik:**
> "jika cpc > 2500 dan spent > 10rb, matiin ads dan ganti kontennya"

**Agent response (conversational):**

```
Hermes: Oke, rule ini butuh konten pengganti saat kondisi terpenuhi.
        Mau pakai media yang mana?

  [📁 Pilih dari Media Library]    [🎨 Generate dari Produk]
```

### Path A — Media Library

```
→ Modal Media Library terbuka
→ User pilih 1–N media
→ Agent konfirmasi: "Pakai media ini sebagai konten pengganti?"
→ [✅ Finish Rules]

Rule tersimpan:
  trigger: cpc > 2500 AND total_spent > 10000
  action:
    1. pause ads yang trigger
    2. swap creative → media_id yang dipilih
    3. notify HSL dashboard
```

Jika media library kosong saat rule mau jalan → **auto top-up prompt** ke user: "Media library kosong, top up dulu?"

### Path B — Generate dari Produk

```
→ "Produk apa yang mau dijadikan konten?"
→ [Pilih dari product catalog]
→ Agent generate brief: judul, copy, visual direction
→ Worker task: GENERATE_PHOTO/VIDEO dari brief
→ Rule pakai output generate sebagai konten pengganti
→ [✅ Finish Rules]

Jika generate belum ada output saat rule mau jalan → auto-trigger generate dulu, hold swap sampai selesai.
```

---

## 3. Command Interface — Level Advanced

### L1 — Single Command, Multi-Account

```
"ambil post id winning dan buat 5 campaign lainnya ke 6 ad account saya
 dengan CBO, bid strat cost cap 55rb, budget mulai dari 50rb"
```

Agent resolve steps:
1. Identifikasi "post id winning" → query campaign monitor, ambil ad dengan ROAS tertinggi / CPA terendah
2. Ambil daftar 6 ad account yang assigned ke user
3. Build 6 × `create_full_launch_v3` payloads: CBO, cost_cap=55000, budget=50000
4. Tampilkan preview table semua 6 campaign sebelum fire
5. User klik **Approve All** → 6 worker tasks ke queue
6. Real-time progress board per ad account

### L2 — Audience Intelligence

```
"buat LLA 2% dari semua purchaser 90 hari terakhir
 di ad account QM ADS 04, 05, dan 06, lalu launch CBO
 ke audience baru itu dengan creative dari campaign X"
```

Agent steps:
1. Pull purchaser list via Meta dataset/pixel events
2. `create_custom_audience` (purchaser seed) per account
3. `create_lookalike_audience` 2% dari seed
4. Build CBO campaign → adset targeting ke LLA baru
5. Reuse creative_id dari campaign X
6. Approval flow → worker eksekusi

### L3 — Performance-Driven Scaling

```
"scale up semua campaign yang ROAS > 3x minggu ini,
 naikkan budget 30%, tapi jangan lewat 500rb per hari per campaign"
```

Agent steps:
1. Pull insights 7 hari via Meta API
2. Filter campaign ROAS > 3.0
3. Hitung new budget = min(current × 1.3, 500000)
4. Preview diff: tabel lama vs baru
5. Approve → batch `update_entity` tasks ke worker

### L4 — Creative Testing Automation

```
"buat ABO test 3 konten berbeda di audience interest cooking,
 budget 30rb masing-masing, auto-kill yang CPC > 3rb setelah 2 hari"
```

Agent steps:
1. Build 3 adset per creative (ABO)
2. Set scheduled rule: t+48h check CPC per adset
3. Pause adset yang exceed threshold
4. Report winner ke user

---

## 4. Arsitektur Teknis

```
┌─────────────────────────────────────────┐
│              HSL Web UI                 │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Agent Capsule (per page)       │    │
│  │  - Text input + response stream │    │
│  │  - Context: page scope          │    │
│  │  - Tool buttons (media, product)│    │
│  └──────────────┬──────────────────┘    │
└─────────────────┼───────────────────────┘
                  │ POST /api/hermes/chat
                  ▼
┌─────────────────────────────────────────┐
│          Hermes Chat API                │
│  - DeepSeek LLM (via src/lib/llm.ts)   │
│  - Tool definitions per scope          │
│  - Context injection (account data,    │
│    campaign state, media library)      │
└──────────────────┬──────────────────────┘
                   │ creates worker_tasks
                   ▼
┌─────────────────────────────────────────┐
│         HSL worker_tasks queue          │
│  - create_full_launch_v3               │
│  - create_custom_audience              │
│  - create_lookalike_audience           │
│  - update_entity (budget/bid/status)   │
│  - pause_entity                        │
│  - GENERATE_PHOTO / GENERATE_VIDEO     │
│  - swap_creative                       │
└──────────────────┬──────────────────────┘
                   │ poll claim
                   ▼
┌─────────────────────────────────────────┐
│        Hermes Worker (Contabo VPS)      │
│  - Meta Marketing API v25.0            │
│  - Media generation pipeline           │
│  - Write-gated (allowlist per account) │
└─────────────────────────────────────────┘
```

---

## 5. Rule Engine Schema (konseptual)

```typescript
type HermesRule = {
  id: string
  name: string
  scope: 'campaign' | 'adset' | 'ad' | 'account'
  
  // Trigger
  conditions: Array<{
    metric: 'cpc' | 'cpm' | 'roas' | 'cpa' | 'spend' | 'impressions' | 'frequency'
    operator: '>' | '<' | '>=' | '<=' | '==' 
    value: number
    window: '1d' | '3d' | '7d' | '30d' | 'lifetime'
  }>
  conditionLogic: 'AND' | 'OR'
  
  // Action
  actions: Array<
    | { type: 'pause_entity' }
    | { type: 'resume_entity' }
    | { type: 'adjust_budget'; delta: number; mode: 'absolute' | 'percent'; cap?: number }
    | { type: 'adjust_bid'; delta: number; mode: 'absolute' | 'percent'; cap?: number }
    | { type: 'swap_creative'; source: 'media_library' | 'generate'; mediaId?: string; generateBrief?: string }
    | { type: 'notify'; channel: 'dashboard' | 'email' }
    | { type: 'create_lookalike'; seedAudienceId: string; percentage: number }
  >
  
  // Meta
  isActive: boolean
  createdByAgentSession?: string
  lastTriggeredAt?: Date
  runHistory: Array<{ triggeredAt: Date; entityId: string; actionsRun: string[]; result: string }>
}
```

---

## 6. Prioritas Build

### Phase 1 — Agent Capsule UI (foundation)
- `POST /api/hermes/chat` — streaming endpoint, context-aware
- Komponen `<AgentCapsule scope={...} />` — prompt box + response stream
- Tool: `query_campaigns`, `query_accounts`, `preview_task`
- Deploy capsule pertama di halaman Campaign Monitor

### Phase 2 — Rule Builder (conversational)
- Guided rule creation via chat
- Media library picker + product catalog picker embedded di chat
- Rule storage di DB + evaluation engine (cron tiap jam)
- Worker task: `evaluate_rules`

### Phase 3 — Multi-Account Command Execution
- Tool: `create_full_launch_batch` (N accounts × M campaigns)
- Approval UI: preview table → bulk approve
- Real-time progress board

### Phase 4 — Audience Intelligence
- Worker task: `create_custom_audience`, `create_lookalike_audience`
- Seed source: pixel events, customer list upload, engagement
- LLA percentage picker di chat context

### Phase 5 — Performance-Driven Automation
- Insights pull scheduled (tiap malam)
- Scale / kill recommendations dari agent
- One-click approve di dashboard

---

## 7. Guardrails

- **Semua write action lewat worker_tasks** — tidak ada direct Meta API call dari HSL server
- **Human approval sebelum duit bergerak** — preview + confirm, tidak ada auto-fire
- **Rule dry-run mode** — sebelum aktifkan, simulasikan dengan data histori
- **Rollback trail** — tiap action di-log, ada tombol "undo" (re-activate + restore budget)
- **Scope isolation** — agent di halaman X tidak bisa akses data halaman Y
- **DeepSeek only** — semua LLM via `src/lib/llm.ts`, tidak ada provider lain

---

*Last updated: 2026-06-12 · Owner: Boy Tenggara*
