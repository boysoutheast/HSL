# Blueprint C — CRUD Completeness: Ad-Account Selection + Delete/Confirm/Admin Se-App

**Owner:** Boy · **Author:** Fable · **Executor:** Sonnet (VPS) · **Date:** 2026-06-21
**Repo:** hermes-support-web · **Goal:** (1) Koneksi Meta bisa **pilih ad account mana yang boleh dipake**. (2) **Tombol delete ada di semua entity** + **konfirmasi seragam** + **admin boleh delete apa pun**. End-to-end fix "masalah serupa" (CRUD setengah jadi).

> Urutan saran: kerjain SEBELUM Blueprint B (visual). C nambah tombol/komponen, B nge-style. Biar B sekalian style yang baru.

---

## 1. AD ACCOUNT SELECTION (skor 2/10 → bisa pilih)

**Temuan:** `MetaAdAccount` cuma punya `accountStatus`(status Meta) + `isDefault`. GAK ada flag "user izinkan buat automation". write-guard (`canWriteToAdAccount`) cuma cek ownership + `MetaAccount.status='connected'` — gak per-ad-account. Detail page `/meta-connections/[id]` tampil ad account READ-ONLY.

### 1.1 Schema (migration additive)
`MetaAdAccount.enabledForAutomation Boolean @default(true) @map("enabled_for_automation")`.
(Default true = back-compat; existing tetap kepake. User bisa matiin yang gak mau.)

### 1.2 write-guard — hormatin flag
`src/lib/write-guard.ts` `canWriteToAdAccount`: tambah cek `adAccount.enabledForAutomation === true`; kalau false → `{ ok:false, reason:'ad_account_disabled' }`. (Fail-closed tetap.)

### 1.3 Backend toggle
`PATCH /api/admin/meta-connections/[id]/ad-accounts` (BARU) — body `{ adAccountId, enabledForAutomation }` ATAU `{ selections: [{id, enabled}] }`. Ownership check (userId/admin). Update `enabledForAutomation`. Return safe.

### 1.4 UI — detail page `/meta-connections/[id]/page.tsx` (tabel ad account read-only → selectable)
- Tiap baris ad account: **toggle "Aktif untuk automation"** (switch). Off = HSL gak akan pakai akun itu buat scan/topup/scale.
- Indikator jelas mana yang ON. Hemat: optimistic toggle → PATCH.
- Kalau campaign udah nempel ke ad account yg di-OFF-in → warning ("campaign X pakai akun ini, automation bakal skip").

### 1.5 Import campaign — filter
`/campaign-monitor/import` step "Pick Ad Account": cuma tampilin / tandai akun `enabledForAutomation=true` (atau kasih hint kalau disabled).

### Acceptance §1
- Toggle ad account off → write-guard tolak (`ad_account_disabled`), scan/topup skip akun itu. Toggle on → jalan lagi. Default existing = true (gak ada regression).

---

## 2. ConfirmDialog REUSABLE (fondasi delete aman)

**Temuan:** gak ada komponen confirm standar — campur `window.confirm` (products, media-library, hermes regen) + Modal (accounts, meta-conn) + ADA yg tanpa konfirmasi (revoke API key, ConnectionsTab:105).

**Bikin `src/components/ui/ConfirmDialog.tsx`** (pakai `Modal.tsx` yg udah ada):
```tsx
<ConfirmDialog
  open={...} title="Hapus [X]?" body="Tindakan ini tidak bisa dibatalkan."
  confirmLabel="Hapus" danger onConfirm={...} onCancel={...} loading={...} />
```
- Tombol confirm pakai `.btn-danger` (destruktif), cancel `.btn-secondary`. Esc/backdrop = cancel.
- Ganti SEMUA `window.confirm` + aksi delete tanpa-konfirmasi pakai ini. **Wajib: tiap delete = lewat ConfirmDialog.**

---

## 3. ADMIN BOLEH DELETE APA PUN (audit SE-REPO)

**Aturan:** tiap DELETE endpoint `/api/admin/**` harus pola:
```ts
where: { id: params.id, ...(auth.role === 'admin' ? {} : { userId: auth.id }) }
```
**Wajib fix (admin-bypass HILANG, terkonfirmasi):**
- `campaign-sessions/[id]/route.ts` (~line 160) — sekarang `userId: auth.id` doang. Tambah admin bypass.
- `campaign-sessions/[id]/creative-pool/[poolId]/route.ts` — sama.

**Audit & pastiin admin-bypass (status "unclear" di audit):** `dead-letters`, `feature-flags`, `meta-accounts/[id]`, `meta-catalogs`, `rule-templates`, `connections/api-keys/[id]`. Cek satu-satu: kalau `requireAuth`+ownership tanpa admin-bypass → tambahin. Kalau `requireAdmin` (admin-only) → udah aman.

**Cara audit:** `grep -rn 'export async function DELETE' src/app/api` → buka tiap file → pastiin admin bisa lewat. Lapor tabel: endpoint | pola auth | admin-bisa? (✓/diperbaiki).

---

## 4. TOMBOL DELETE yang HILANG (endpoint ada, UI gak ada)

Tambah tombol delete + ConfirmDialog (§2) di:
| Halaman | Endpoint (udah ada) | Catatan |
|---|---|---|
| `characters/page.tsx` | `DELETE /api/admin/characters/[id]` | list read-only → tambah aksi delete per row |
| `ceps/page.tsx` | `DELETE /api/admin/ceps/[id]` | tambah delete (selain approve/reject) |
| `test-launches/page.tsx` | `DELETE /api/admin/test-launches/[id]` | cuma boleh kalau status draft (endpoint udah guard) — disable tombol kalau non-draft + tooltip |
| `media-rules/page.tsx` | `DELETE /api/admin/media-rules/[id]` | tambah delete selain toggle status |
| `system/ConnectionsTab.tsx` (Hermes Agents) | `DELETE /api/admin/hermes-agents/[id]` | tambah tombol Hapus agent (skrg cuma toggle/regen) |
| `system/ConnectionsTab.tsx` (API keys) | revoke (udah ada) | TAMBAH konfirmasi (skrg langsung, §2) |

(Yang udah punya delete+confirm — products, accounts, meta-connections — sekalian migrasi ke ConfirmDialog biar seragam.)

---

## 5. automation-rules — DELETE endpoint (HILANG)

`automation-rules/[id]` cuma punya PATCH status. Tambah `DELETE /api/admin/automation-rules/[id]` (admin-bypass + ownership via campaignSession.userId). UI: tombol "Hapus rule" di campaign detail Automation tab (selain "Lepas" yg detach). (Hati-hati bedain detach vs delete-template — ini delete instance AutomationRule.)

> Kalau "Lepas" (detach) udah cukup secara produk, SKIP delete-rule & lapor. Jangan bikin redundant.

---

## 6. ACCEPTANCE
1. tsc clean · build exit 0 · migration `enabled_for_automation` applied.
2. Ad account toggle: off → write-guard `ad_account_disabled` + scan/topup skip; on → jalan. Default true.
3. ConfirmDialog dipakai di SEMUA delete (0 `window.confirm` sisa, 0 delete tanpa konfirmasi). `grep -rn 'window.confirm' src/app` = 0.
4. Admin bypass di SEMUA DELETE `/api/admin/**` (tabel audit §3, campaign-sessions+creative-pool fixed).
5. Tombol delete muncul di 6 halaman §4, tiap klik → ConfirmDialog → delete → list refresh.
6. Guard existing (ownership non-admin, write-guard, atomic) UTUH — admin-bypass JANGAN ngebocorin ke non-admin.

## 7. SMOKE LIVE
- **S1** Detail koneksi → matiin 1 ad account → scan campaign di akun itu → skip (`ad_account_disabled` di log). Nyalain → jalan.
- **S2** Hapus character (admin) → ConfirmDialog muncul → confirm → kehapus. Cancel → gak kehapus.
- **S3** Admin hapus campaign-session punya user lain → berhasil (sebelumnya gagal). Non-admin hapus punya orang → tetap 404/forbidden.
- **S4** Revoke API key → sekarang ADA konfirmasi.
- **S5** Regresi: delete existing (products/accounts/meta-conn) masih jalan via ConfirmDialog.
Jujur visual vs code.

## 8. EKSEKUSI & LAPORAN
- Branch `feat/crud-completeness`. Commit per § (ad-account → ConfirmDialog → admin-bypass → delete-buttons → automation-rules). Jangan merge sendiri.
- DILARANG: admin-bypass bocor ke non-admin; delete tanpa ConfirmDialog; drop write-guard/ownership.
- LAPOR MAC AUDIT: `git diff --stat` (TWO-DOT main..HEAD — cek gak ada file nyasar), `grep window.confirm`=0, tabel audit DELETE admin-bypass, migration, smoke S1–S5, STATUS.

## 9. ⚠️ CLEANUP
`git rm docs/blueprints/crud-completeness-blueprint.md` setelah deploy SUKSES. Lihat [[feedback-delete-blueprints-after-deploy]].
```
