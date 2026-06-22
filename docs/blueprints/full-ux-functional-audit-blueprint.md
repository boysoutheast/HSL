# Blueprint: Audit UX + Fungsional Total (per-fungsi 1-by-1)

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION
**Auditor:** Fable 5 · **Executor:** Sonnet (VPS)
**Estimasi:** 3–5 jam (besar — boleh dicicil per kategori, commit per kategori)

> Scope nyata: **45 halaman UI, 154 endpoint (118 admin).** Tujuan: (1) inventaris SETIAP
> fungsi/tombol/form + status jalan/rusak, (2) UX gap per kategori + checklist improvement,
> (3) flowchart journey register→pakai-semua-fitur + titik friksi.
> Pemicu: "add campaign aja bisa error" (act_act_ bug) + gap nyata (no forgot-password,
> no delete-user). Banyak fungsi belum pernah ditest.
>
> Ini DISCOVERY/AUDIT — output utama = DOKUMEN temuan + checklist + flowchart. Perbaikan
> kode menyusul setelah Boy review. JANGAN ngerombak fitur tanpa approval; fix HANYA yang
> jelas rusak-sepele (dead button, endpoint 404, label salah) + lapor.

---

## KATEGORI (pakai pembagian ini biar tractable, commit per kategori)
A. **Auth & Onboarding** — login, register, (forgot-password GAP), session, logout, profile, settings
B. **Accounts** — accounts, accounts/[id], characters, topics, ceps, photos, influencer
C. **Ads** — ads, campaign-monitor(+[id], import, rules/new), test-launches(+new,[id]), approval-requests, action-center, performance, rules-editor(+builder), assignments
D. **Studio/Media** — media, media-library(+[id]), media-rules, studio, products(+[id])
E. **System** — system, admin-users, agents, meta-connections(+new,[id]), monitor, logs, docs, settings

---

## PHASE 1 — Inventaris Fungsi (per-fungsi, EXHAUSTIVE)

Untuk TIAP halaman (45), enumerasi SETIAP elemen interaktif: tombol, form, dropdown, toggle, link aksi, modal, bulk-action. Untuk tiap fungsi, isi tabel:

| Kategori | Halaman | Fungsi (label/aksi) | Endpoint backing | Endpoint ADA? | Status |
|---|---|---|---|---|---|

Status = tiap fungsi:
- **OK** — handler ada, endpoint ada, alur masuk akal.
- **DEAD** — tombol/aksi tanpa handler, atau handler nunjuk endpoint yang gak ada (404). FATAL.
- **BROKEN** — endpoint ada tapi salah (mis. salah format kaya act_act_, salah method, payload gak match).
- **MISSING-CRUD** — ada Create/Read tapi gak ada Update/Delete yang semestinya ada (mis. admin-users gak ada Delete/Deactivate — CONFIRMED gap).
- **NO-UI** — endpoint ada tapi gak ada UI yang manggil (fitur kependam).

Cara kerja: baca tiap `page.tsx` → catat tiap `onClick`/`<form>`/`fetch(`. Cross-ref ke `src/app/api/**`. Untuk NO-UI: bandingkan 118 admin endpoint vs yang dipanggil UI.

DEAD/BROKEN sepele (typo endpoint, method salah, 404 nyata) → BOLEH fix langsung + catat. Yang butuh fitur baru → JANGAN bikin, masuk checklist PHASE 3.

---

## PHASE 2 — Smoke Test Alur Kritis (LIVE, prioritas)

Gak semua 154 endpoint bisa dilive-test. Test alur PALING KRITIS pakai admin session (kredensial yang ADA — JANGAN reset password):
1. Auth: login, logout, register (lihat: bisa daftar? approval flow jalan?)
2. Create Meta connection / OAuth (read-only cek)
3. Import Meta Campaign (yang error kemarin) — pastikan campaign muncul
4. Create campaign (PAUSED) + create full launch (PAUSED) — cleanup
5. Generate video (gen) — 1 job
6. Create account/character/topic/cep/product — CRUD penuh (Create→Read→Update→Delete) — INI yang bakal nemu gap "gak ada delete"
7. Automation rule create + dry-run
8. Audience/catalog create (catalog mungkin DEFERRED token scope)

Tiap alur: PASS/FAIL + bukti mentah (HTTP status + response). FAIL sepele → fix → retest. Butuh data/kredensial gak ada → SMOKE-DEFERRED + alasan. Campaign selalu PAUSED + cleanup. Record di DB (AutomationAction) biarin sebagai jejak.

---

## PHASE 3 — UX Completeness Audit per Kategori + Checklist

Untuk tiap kategori (A–E), cek kelengkapan UX standar SaaS. Buat **checklist** (markdown checkbox) per kategori, tandai ADA/GAP:

Cek minimal tiap kategori:
- **CRUD lengkap?** tiap entity bisa Create/Read/Update/**Delete**/Archive? (admin-users gak ada delete = GAP konfirmasi)
- **Empty state** — pas data kosong ada panduan/CTA, bukan layar kosong?
- **Loading & error state** — ada spinner + pesan error yang kebaca (bukan diam/blank)?
- **Confirmation** — aksi destruktif (delete, pause, launch) ada konfirmasi?
- **Search / filter / sort / pagination** — list panjang ada?
- **Bulk action** — perlu select-banyak?
- **Validation feedback** — form kasih error per-field?
- **Onboarding / tooltip** — fitur kompleks ada penjelasan?

**Gap auth yang sudah dikonfirmasi (seed checklist):**
- [ ] **Forgot/Reset password** — TIDAK ADA. User kekunci selamanya kalau lupa. (FATAL UX gap)
- [ ] **Delete/Deactivate user** — admin-users gak ada. (GAP)
- [ ] Change password dari Settings — cek ada/gak
- [ ] Email verification saat register — cek
- [ ] Resend approval / notif ke admin saat user register — cek

Output: checklist per kategori + daftar "Quick wins" (gap sepele tapi high-impact, kaya forgot-password) vs "Bigger" (butuh desain).

---

## PHASE 4 — Flowchart User Journey (Mermaid)

Buat flowchart Mermaid di report: **Register → Approval admin → Login → Setup (connect Meta) → pakai tiap fitur (generate, campaign, automation, monitor) → hasil.** Di tiap step, tandai:
- 🔴 friksi/gap (mis. "lupa password → buntu", "gak ada email verif", "gak tau harus connect Meta dulu")
- 🟡 bisa diperbaiki (mis. "gak ada onboarding checklist", "empty state gak ada CTA")
- 🟢 udah oke

Sertakan minimal 1 flowchart utama + tandai improvement per node.

---

## PHASE 5 — Report Konsolidasi + Checklist Prioritas

`docs/full-ux-functional-audit-report.md`:
1. **Tabel inventaris fungsi** (PHASE 1) — semua fungsi + status. Hitung: total OK / DEAD / BROKEN / MISSING-CRUD / NO-UI.
2. **Hasil smoke test** (PHASE 2) — PASS/FAIL per alur + bukti.
3. **Checklist UX per kategori** (PHASE 3) — ADA/GAP.
4. **Flowchart journey** (PHASE 4).
5. **Prioritized improvement list:** P0 (fatal: forgot-password, dead button, broken endpoint) → P1 (missing CRUD) → P2 (UX polish). Tiap item: dampak + effort kasar.
6. Yang udah di-fix langsung (dead/broken sepele) + commit.

---

## ATURAN WAJIB (GUARDRAIL)
- **DILARANG reset/ubah password produksi.** Pakai kredensial yang ADA. Jangan dump secret/hash ke file. (Lo udah pernah langgar — jangan ulangi.)
- Fix langsung HANYA untuk: dead button, endpoint 404 nyata, label/route typo, format bug (kaya act_). Fitur baru / perubahan desain → checklist, JANGAN bikin tanpa approval Boy.
- Campaign/ad saat smoke test SELALU PAUSED + cleanup objek Meta.
- tsc + npm run build WAJIB lulus tiap commit (selain driver.js). DILARANG force-push. Commit per kategori. git pull --rebase kalau ketolak.
- **Anti-ngarang (report lo pernah palsu):** report WAJIB paste OUTPUT MENTAH — daftar fungsi per halaman dari pembacaan kode, hasil smoke test (HTTP response), `git rev-parse origin/main`, tsc/build tail. Inventaris harus dari baca file nyata, bukan tebakan. Fable cross-check sendiri.

Kirim ke Boy: total fungsi (OK/DEAD/BROKEN/MISSING-CRUD/NO-UI) + jumlah gap UX + P0 list + flowchart + commit hashes + git rev-parse origin/main + smoke test.
```
