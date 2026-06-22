# Blueprint: Audit Bug "Sederhana tapi Fatal" (runtime-only)

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION
**Auditor:** Fable 5 · **Executor:** Sonnet (VPS)
**Estimasi:** 40–60 menit

> Konteks: ditemukan bug double-prefix `act_act_...` di meta-campaigns (import) — lolos
> tsc+build, tapi gagal total di runtime ke Meta API. Kelas bug ini: salah konstruksi
> path/param ke API eksternal, gak ketangkep compiler. Sapu SEMUA yang sejenis.

---

## KONVENSI KANONIK (acuan benar — patokan audit)

Dari kode existing yang sudah BENAR:
- **Path ad account lengkap** → pakai `normalizeMetaAdAccountPath(id)` (di `src/lib/meta-graph.ts`) — nambah `act_` hanya kalau belum ada.
- **Helper `createCampaign`/`createAdset`/`createAd`/`uploadImageToMeta`** (meta-client.ts) → param `adAccountId` harus **NUMERIC (tanpa `act_`)** karena helper sendiri yang `act_${id}`. Caller WAJIB `.replace(/^act_/, '')` dulu.
- **`adAccountId` di DB disimpan DENGAN prefix `act_`** (dari meta-oauth callback). Jadi tiap kali dipakai harus disadari formatnya.

Bug = setiap penyimpangan dari konvensi ini.

---

## PHASE 1 — Audit prefix `act_` (akar bug yang ketemu)

```bash
grep -rn 'act_\$' src/ --include="*.ts"
```
Untuk TIAP hasil, TRACE format variabelnya:
- Variabel udah ada `act_`? (mis. `adAccount.adAccountId` dari DB) + di-`act_${...}` lagi → **DOUBLE PREFIX, bug.**
- Variabel udah di-`.replace(/^act_/,'')` sebelumnya? → aman.
- Ada cek `.startsWith('act_')`? → aman.

Klasifikasi tiap baris: SAFE / BUG. Yang BUG → fix:
- Untuk full path → `normalizeMetaAdAccountPath(id)`.
- Untuk helper call → pastikan caller `.replace(/^act_/,'')`.

Cross-check juga: tiap pemanggilan `createCampaign(`, `createAdset(`, `createAd(`, `uploadImageToMeta(` → argumen adAccountId-nya numeric (udah di-strip)? Kalau dilempar mentah dari DB (masih `act_`) → BUG.

---

## PHASE 2 — Audit ID Meta lain (pola prefix/format serupa)

ID Meta lain yang gampang salah format:
```bash
grep -rn "pixel_id\|pixelId\|page_id\|pageId\|business_id\|businessId\|metaCampaignId\|metaEntityId\|adsetId\|campaign_id\|metaAdAccountId" src/ --include="*.ts" | grep -iE "graph|metaPost|metaGet|graphFetch|fetch\(|url"
```
Cek tiap konstruksi path/param: pakai ID yang BENAR? Jangan ketuker:
- **DB id (cuid)** vs **Meta id (numerik panjang)** — sering ketuker (kirim cuid internal ke Meta = "object not found").
- Page/pixel/business id formatnya benar (gak ke-prefix salah).

Laporkan tiap yang BUG/SUSPECT dengan file:line + alasan.

---

## PHASE 3 — Audit kelas "fatal runtime" lain

Cek pola ini (lolos compiler, gagal runtime):
1. **Param objek ke Meta tanpa `JSON.stringify`** — Meta minta beberapa field (targeting, special_ad_categories, promoted_object) sebagai JSON string. Kirim object mentah → error.
   ```bash
   grep -rn "metaPost\|graphFetch" src/ --include="*.ts" | head
   ```
   Untuk body yang punya targeting/special_ad_categories/promoted_object/lookalike_spec — pastikan di-`JSON.stringify`.
2. **Budget satuan salah** — Meta pakai MINOR units (sen). Cek `daily_budget`/`lifetime_budget`/`bid_amount`: dikali/dikonversi ke minor dengan benar? `grep -rn "daily_budget\|lifetime_budget\|bid_amount\|budgetMinor"`.
3. **API version inkonsisten** — semua harus v25.0. `grep -rn "graph.facebook.com/v\|MAPI_VERSION\|GRAPH_BASE\|v2[0-9]\." src/` — ada yang beda versi?
4. **`await` ketinggalan** pada call async Meta (fire tanpa await → error gak ketangkep). Cek call `metaPost`/`graphFetch`/`createAd` tanpa `await`.
5. **Token salah scope/akun** — pastikan token yang dipakai dari `getMetaToken(userId, metaAccountId)` yang benar (bukan akun lain).

Tiap temuan: file:line + jenis + dampak + fix.

---

## PHASE 4 — Fix + Verify

- Fix tiap BUG (PHASE 1–3) pakai konvensi kanonik / helper yang ada. JANGAN bikin konvensi baru.
- Yang SUSPECT/ambigu (gak yakin format runtime-nya) → JANGAN tebak; tulis di report sebagai SUSPECT + alasan, biar Boy/Fable putuskan.
- `npx prisma generate && npx tsc --noEmit && npm run build` — WAJIB lulus (selain driver.js).

---

## PHASE 5 — Smoke test (yang bisa)

Login admin (kredensial yang ADA — JANGAN reset password). Untuk path yang difix + bisa ditest:
- **Import Meta Campaign** (`/api/admin/meta-campaigns?metaAdAccountId=...`) — yang error di screenshot. Cek campaign muncul / gak ada `act_act_` lagi. Paste response mentah.
- Path lain yang difix → test ringan kalau memungkinkan (read-only / PAUSED + cleanup).
Kalau butuh kredensial/akun yang gak ada → SMOKE-DEFERRED + alasan.

---

## ATURAN WAJIB (GUARDRAIL)
- **DILARANG reset/ubah password produksi.** Pakai kredensial yang ada buat session. Jangan dump hash/secret ke file.
- TRACE format tiap variabel sebelum fix — jangan asal `.replace`. Salah arah malah bikin bug baru.
- tsc + npm run build WAJIB lulus. DILARANG force-push. Commit per phase. git pull --rebase kalau ketolak.
- **Anti-ngarang:** report WAJIB paste OUTPUT MENTAH — hasil grep tiap phase, daftar BUG vs SAFE per baris (file:line), `git rev-parse origin/main` akhir, tsc/build tail. PASS tanpa output mentah = ditolak.

## Report: `docs/runtime-fatal-audit-report.md`
- Tabel temuan: file:line | kelas bug | SAFE/BUG/SUSPECT | fix | commit
- Hasil grep mentah tiap phase
- Smoke test hasil + bukti
- `git rev-parse origin/main` + tsc/build status

Kirim ke Boy: jumlah BUG ketemu+difix, SUSPECT yang perlu keputusan, commit hashes, git rev-parse origin/main, smoke test.
