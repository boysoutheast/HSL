# Blueprint D: Rule Creation Template-First — Biar User Non-Teknis Bisa

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION (Sonnet)
**Estimasi:** 3–4 jam · Kunci "semudah mungkin"
**Tujuan:** User set rule automation (scale winner / kill loser / dll) dalam 2-3 klik dari preset, BUKAN nyusun condition tree manual. Builder advanced tetap ada buat power user.

---

## 0. Yang sudah ada
`RuleTemplate` (model + endpoint `/api/admin/rule-templates`) ADA, tapi **belum ada built-in template yang di-seed**. `conditionTreeJson`+`actionSpecJson` shape udah dipakai rule-engine. Attach template ke campaign udah ada (`POST /campaign-sessions/[id]/rules`). `rule-readable.ts` parse tree → human text.

## 1. Masalah
User non-teknis gak ngerti `{op:AND, children:[{metric:roas, operator:gt, value:2}]}`. Nyusun manual = gak kepakai. Butuh preset siap-pakai + bahasa manusia.

## 2. Seed built-in templates (`prisma/seed.ts` atau migration data)
Buat 6-8 template `isBuiltin=true`, `userId=null`, bahasa Indonesia, preset Meta best-practice:

| Nama | Kondisi | Aksi |
|---|---|---|
| 🚀 Scale Winner | roas > 2 DAN spend > 50rb | budget +20% |
| 🛑 Kill Loser | spend > 100rb DAN purchase = 0 | pause adset |
| 📉 Turun Budget Boros | cpc > 5rb DAN roas < 1 | budget -20% |
| ⏸️ Pause CTR Jelek | ctr < 1% DAN impressions > 5000 | pause adset |
| 🔥 Scale Agresif | roas > 4 | budget +30% |
| 💤 Pause Tidur | spend > 50rb DAN impressions < 500 | pause adset |

Tiap template: parameter bisa di-tweak user saat attach (threshold/persen). Simpan `conditionTreeJson`+`actionSpecJson` valid yang rule-engine ngerti.

## 3. UI — Attach rule (template-first)
Ganti/utamakan flow preset di campaign detail → Automation tab → "+ Tambah Rule":
```
┌ Pilih aturan otomatis ─────────────────────────────────┐
│  🚀 Scale Winner                                        │
│     Kalau ROAS > [2] dan spend > [Rp50rb]               │
│     → naikin budget [20]%                    [Pakai →]  │
│                                                          │
│  🛑 Kill Loser                                          │
│     Kalau spend > [Rp100rb] dan 0 pembelian             │
│     → matikan adset                          [Pakai →]  │
│  ...                                                     │
│                                                          │
│  ⚙️ Buat sendiri (advanced)  → builder manual           │
└──────────────────────────────────────────────────────────┘
```
- Tiap preset = card dgn angka **inline-editable** (threshold/persen). User cuma ubah angka, klik "Pakai".
- "Pakai" → POST attach (template instantiate dgn override angka) → rule ACTIVE.
- Link kecil ke builder manual buat power user (yang udah ada).
- Tiap rule terpasang tampil pakai `rule-readable.ts` (bahasa manusia, bukan JSON).

## 4. Parameter override saat attach
`POST /campaign-sessions/[id]/rules` perlu nerima override threshold/amount, bukan cuma cooldown:
```
Body: { templateId, params?: { threshold?, amount?, ... }, overrides?: {cooldownMinutes?} }
→ inject params ke conditionTreeJson/actionSpecJson sebelum simpan jadi AutomationRule
```
(Atau template punya `paramSchema` yang nentuin angka mana yang editable.)

## 5. Acceptance
- [ ] 6-8 built-in template ke-seed (isBuiltin, userId null, bahasa ID, valid utk rule-engine)
- [ ] UI attach: card preset + angka inline-editable + "Pakai" 1 klik
- [ ] Override param threshold/amount masuk ke rule tersimpan (verifikasi rule-engine baca bener)
- [ ] Builder manual tetap ada (link advanced)
- [ ] Rule terpasang tampil human-readable (rule-readable.ts)
- [ ] Idempoten attach, scoped userId, tsc 0 · /docs

## 6. Execution Order
```
1. Seed built-in templates (prisma/seed.ts — idempotent upsert by name+isBuiltin)
2. POST rules: terima params override → inject ke tree sebelum simpan
3. UI: template picker card + inline param edit + Pakai
4. Verifikasi rule-engine evaluasi template hasil override dgn bener (unit/integration)
5. /docs + tsc · commit per langkah
```
## Aturan: template valid 100% utk rule-engine (test!). Bahasa Indonesia manusiawi. No force-push.
