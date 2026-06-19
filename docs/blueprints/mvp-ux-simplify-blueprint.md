# Blueprint: UI/UX Simplify — Campaign Automation "Semudah Mungkin"

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION (Sonnet)
**Estimasi:** 2–3 jam · UI-only, NO schema/endpoint baru (pakai yang sudah ada)
**Masalah:** Setup automation kesebar di 6 tab + lintas halaman. User harus loncat: import → cari attach rule → cari tab topup → cari toggle. Capek.

---

## 1. Diagnosa (kondisi sekarang)

Campaign detail (`/campaign-monitor/[id]`) punya **6 tab**: `overview · meta · actions · rules · audit · topup`.
- `rules` + `topup` = hal yang user SETTING (automation config) — kepisah 2 tab.
- `actions` + `audit` = hal yang user LIHAT (history) — kepisah 2 tab.
- `meta` = raw state, power-user.
- Toggle Auto ON/OFF + scan interval ada di list card, kepisah dari tempat attach rule.

Akibat: untuk 1 campaign jalan, user nyentuh 3-4 tempat berbeda. Gak ada panduan urutan.

---

## 2. Target: 3 tab + guided setup

Ciutkan 6 → **3 tab**:

| Tab baru | Gabungan dari | Isi |
|---|---|---|
| **Overview** | overview + meta (collapsible) | Status, metrik kunci, **Automation summary card** (toggle + interval inline), raw Meta state di accordion bawah |
| **Automation** | rules + topup | SEMUA setting: rules list + attach, floor + pool — satu halaman, 2 section |
| **Activity** | actions + audit | Timeline gabungan: scan, rule fired, action applied, top-up — 1 feed kronologis |

Prinsip: **Setting di 1 tab, Lihat di 1 tab, Status di 1 tab.**

---

## 3. Guided Setup (kunci "semudah mungkin")

Pas campaign baru di-import (`importStatus` belum lengkap / belum ada rule), tampilin **checklist banner** di Overview:

```
┌─ Setup campaign ini (2 dari 4 selesai) ───────────────────┐
│  ✅ 1. Campaign ke-sync dari Meta                          │
│  ✅ 2. Budget & struktur kebaca                            │
│  ⬜ 3. Attach minimal 1 rule       → [Pilih template]     │
│  ⬜ 4. Nyalain automation          → (kebuka stlh step 3)  │
│                                                            │
│  Opsional: set floor auto top-up   → [Atur]               │
└────────────────────────────────────────────────────────────┘
```
- Tiap step = 1 klik ke aksi yang tepat (bukan "cari sendiri").
- Step 4 (toggle automation) **disabled sampai step 3 beres** — match guard 422 backend, jadi user gak ketemu error.
- Banner ilang otomatis kalau automationEnabled=true (setup selesai).

---

## 4. Detail per tab

### 4.1 Overview
```
[Status pill: 🟢 RUNNING · Auto ON · scan tiap 15m]   [nama campaign]

┌ 4 angka ─────────────────────────────────────────┐
│ Spend 7d │ ROAS │ Active ads │ Budget/hari        │
└───────────────────────────────────────────────────┘

┌ Automation ────────────────── [⚙️ Atur di tab Automation] ┐
│ Auto: [ON ●]   Scan: [15m ▾]                              │
│ 2 rules aktif · floor 3 ads · pool 5 siap                 │
│ Terakhir scan 3m lalu — 1 rule fired (budget +20%)        │
└────────────────────────────────────────────────────────────┘

▸ Raw Meta state (accordion, default tutup) — isi tab 'meta' lama
```
- Toggle + interval LANGSUNG bisa di sini (inline PATCH) — gak perlu pindah tab.
- Summary 1 baris narasi terakhir scan (ramah, bukan tabel).

### 4.2 Automation (gabung rules + topup)
Dua section di 1 scroll:
```
═ Rules ══════════════════════════════ [+ Attach template] ═
  ⚙️ Scale winner   ACTIVE  fired 3×   IF roas>2 → budget +20%  [detach]
  ⚙️ Kill loser     ACTIVE  fired 0×   IF spend>100k & buy=0 → pause [detach]

═ Auto Top-Up ════════════════════════ [Toggle ON/OFF] ══════
  Min ads aktif: [3]   Adset tujuan: [Broad 25-45 ▾]
  Status: 🟢 4/3 di atas floor
  ── Creative Pool (5 available · 2 used) ── [+ Tambah] [Paste banyak]
  #1 "Kulit kusam? Glow 7 hari..."  available  [edit]
  #2 ...
```
- Pakai komponen yang SUDAH ada (TopUpTab isinya pindah ke sini sebagai section; rules list dari tab rules pindah ke section atas). Jangan bikin ulang — relokasi.

### 4.3 Activity (gabung actions + audit)
Satu timeline kronologis, sumber: AutomationAction + RuleExecution + CampaignTopupLog (polling 30s):
```
🔄 14:30  Scan — 2 rules dievaluasi, 1 match
   ↳ ⬆️ Budget "Broad 25-45" 50k→60k        SUCCEEDED
🔼 14:30  Top-up — 2→3 ads, creative #1       ad_123 SUCCESS
🔄 14:15  Scan — 0 match
⚠️ 09:15  Pool habis — notif terkirim
```
- Filter chip: Semua / Scan / Action / Top-up.
- Ganti tab `actions` (tabel mentah) + `audit` jadi 1 feed manusiawi.

---

## 5. Cross-page (list `/ads?tab=campaigns`)

- Tombol header: **[+ Import Campaign]** + **[+ New Launch]** (dua-duanya jelas).
- Card campaign: badge `🔵 Imported`/`🚀 Launch`, status pill, `⚙️ 2 rules`, `🔼 floor 3`, `🔄 3m`. Klik card → Overview.
- Card yang setup belum kelar (no rule / auto off): badge `⚠️ Setup belum selesai` → klik langsung ke checklist.

---

## 6. Acceptance

- [ ] Detail campaign jadi 3 tab (Overview/Automation/Activity); meta jadi accordion di Overview
- [ ] Toggle Auto + interval bisa diubah inline dari Overview (PATCH session)
- [ ] Checklist banner muncul kalau setup belum kelar; step disabled sesuai guard; ilang kalau auto ON
- [ ] Automation tab: rules section + top-up section (relokasi komponen lama, bukan rewrite)
- [ ] Activity tab: 1 timeline gabungan + filter chip
- [ ] Card list: badge setup-belum-selesai → deep-link ke checklist
- [ ] Gak ada endpoint/schema baru — UI-only
- [ ] tsc 0 error · update /docs kalau ada perubahan alur user-facing

---

## 7. Execution Order
```
1. Refactor detail page: 6 tab → 3 (Overview/Automation/Activity). Relokasi panel lama, jgn hapus logika.
2. Overview: automation summary card + inline toggle/interval + Meta accordion
3. Checklist banner (state dari importStatus + rule count + automationEnabled)
4. Automation tab: merge rules list + TopUpTab jadi 2 section
5. Activity tab: merge actions+audit+topup-log jadi 1 feed + filter
6. Card list: badge setup status + deep-link
7. tsc → fix · /docs kalau perlu · commit per langkah · push branch feat/ux-simplify
```

## Aturan Wajib
- UI-only, NO schema/endpoint baru. Pakai PATCH/GET yang sudah ada.
- Relokasi komponen (TopUpTab, rules list) — JANGAN rewrite dari nol, pindahin.
- Light mode only (dark dimatiin). Jangan link ke route lama (loop — insiden F1).
- tsc 0 error. No force-push. Commit per langkah. JANGAN merge — tunggu audit Fable.
