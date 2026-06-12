# Create Campaign — End Game Vision

> **Core thesis:** Bikin campaign Meta harusnya secepat ngetik satu kalimat — karena semua bahan (produk, persona, media, audience, landing page, pixel) sudah hidup di HSL, dan eksekusinya sudah dibuktikan jalan end-to-end lewat payload v3 → worker → Meta.

> Dokumen kembar: [endgame.md](./endgame.md) (agent capsule per halaman). Dokumen ini khusus jalur **pembuatan campaign** — dari wizard manual hari ini sampai one-liner launch.

---

## 1. Tangga Evolusi

```
L0  Wizard manual (HARI INI — shipped)
    4 step: Campaign → Ad Sets → Ads → Review
    Semua field diisi tangan. Sudah full green ke Meta (PAUSED).

L1  Wizard pintar (prefill everything)
    Pilih produk → semua field yang bisa ditebak, ketebak.
    User tinggal koreksi, bukan mengisi.

L2  Template & clone
    "Simpan sebagai template" / "Clone launch kemarin, ganti budget".
    Satu klik dari riwayat launch yang menang.

L3  Conversational launch (agent capsule di wizard)
    "CBO sales 100rb buat Glazingskin, audience LLA purchaser,
     3 creative dari media library" → draft wizard keisi penuh
    → user review → submit.

L4  Command launch (tanpa wizard)
    One-liner dari halaman mana pun → preview table → approve →
    worker fire. (= L1 Multi-Account di endgame.md)
```

Prinsip naik tangga: **tiap level tetap berakhir di Review + human approval**. Yang berubah cuma seberapa banyak yang harus diketik manusia sebelum sampai ke Review.

---

## 2. L1 — Wizard Pintar (prefill everything)

Sumber prefill sudah ada semua di DB. Tinggal disambung:

| Field wizard | Sumber prefill | Status sumber |
|---|---|---|
| Nama campaign | `{produk} - {objective} - {tanggal}` | trivial |
| Objective | default per produk (riwayat launch produk itu) | ada di `test_launches` |
| Ad account + pixel | last-used per user, atau default connection | ada |
| Website URL | `landing_pages` produk (isDefault dulu) | ✅ shipped |
| Primary text / headline / description | generate DeepSeek dari produk (benefit, CEP aktif) via `src/lib/llm.ts` | lib ada, endpoint belum |
| Media | media library filter `productId` + status READY | ✅ shipped |
| Audience age/gender | dari persona IG account (gender M/F, deskripsi) | ✅ shipped (merge character) |
| Interests | DeepSeek suggest dari kategori produk → validasi via interest-search | endpoint ✅ |
| Custom audiences | fetch live per ad account | ✅ shipped |
| Identity Page+IG | last-used per ad account | fetch ✅ |

**UX-nya:** step 0 baru — "Mulai dari mana?"

```
[ 🛍 Dari Produk ]   [ 📋 Dari Template ]   [ ♻️ Clone Launch ]   [ ✏️ Kosong ]
```

Pilih produk → wizard kebuka dengan ~80% field keisi, semua field prefilled diberi tanda kecil "auto" — sekali klik untuk clear.

---

## 3. L2 — Template & Clone

### Template
- Tombol "Simpan sebagai template" di step Review.
- Yang disimpan: SEMUA kecuali nama campaign + media (media selalu dipilih ulang/di-refresh biar nggak creative fatigue).
- Schema: tabel `launch_templates` (JSON snapshot form state + versi payload).

### Clone
- Dari list `/test-launches`: tombol "Clone" per row → wizard kebuka penuh dengan data launch itu.
- Dari Campaign Monitor: **"Clone winner"** — ambil campaign dengan ROAS terbaik, prefill wizard, tinggal ganti yang perlu.
- Clone lintas ad account: pilih target account → pixel/page/audience di-remap otomatis (fetch ulang per account, yang nggak ketemu dikosongin + ditandai merah).

---

## 4. L3 — Conversational Launch (capsule di wizard)

Agent capsule (komponen dari endgame.md) hadir di halaman wizard dengan scope: form state wizard itu sendiri.

**User mengetik:**
> "ABO 2 adset, satu interest skincare satu LLA purchaser, budget 50rb per adset, pakai 3 foto terbaru produk Glazingskin, CTA shop now"

**Agent resolve:**
1. Parse → patch form state (budgetMode=ABO, 2 adset draft, budget, CTA)
2. Interest "skincare" → call interest-search → pilih top match, tampil sebagai chip (user bisa hapus)
3. "LLA purchaser" → cari di custom audiences ad account; kalau nggak ada → tawarkan create (worker task `create_lookalike_audience`, Phase 4 endgame.md)
4. "3 foto terbaru Glazingskin" → query media-assets productId + READY, ambil 3
5. Copy (primary/headline) → generate DeepSeek dari produk + CEP
6. **Agent TIDAK pernah submit** — dia cuma ngisi form. User tetap lewat Review → Submit → approval flow.

Kontrak teknis: agent output = JSON patch terhadap form state wizard (schema sama dengan POST body). Satu kontrak, gampang ditest.

---

## 5. L4 — Command Launch (tanpa wizard)

Naik satu level: dari halaman mana pun (atau dari Hermes agent eksternal via API):

```
"launch CBO sales 100rb di 3 ad account: Glazingskin, QM04, QM05.
 audience broad 25-45 wanita, creative video terbaik bulan ini,
 cost cap 55rb"
```

Flow:
1. Agent build N × draft launch (POST /api/admin/test-launches per account, status draft)
2. **Preview table** — satu baris per account: budget, audience, creative, estimasi
3. User: Approve All / approve sebagian / buka satu di wizard buat edit
4. Approve → approval_requests → worker_tasks `create_full_launch_v3` (pipeline yang sudah live & terbukti)
5. Progress board real-time per account (status task dari worker_registry + worker_tasks)

Ini = use case L1/L2 di endgame.md §3 — dokumen ini mendefinisikan *bagaimana jalur create-nya*, endgame.md mendefinisikan *command surface-nya*.

---

## 6. Arsitektur Delta (yang perlu dibangun di atas yang ada)

```
SUDAH ADA (terbukti live 2026-06-12):
  wizard v2 4-step → POST test-launches (v3 nested)
  → approval_requests → worker_tasks create_full_launch_v3
  → worker (write-gated, PAUSED-only) → Meta campaign/adset/ad
  → readback verified

DELTA PER LEVEL:
  L1: + GET /api/admin/launch-prefill?productId=...
        (compose: landing page, media, persona, last-used account/pixel)
      + POST /api/admin/meta-tools/generate-copy  (DeepSeek)
  L2: + tabel launch_templates + endpoint CRUD
      + tombol Clone (pure frontend, data sudah ada di GET launch)
  L3: + AgentCapsule scope="launch-wizard"
      + kontrak JSON-patch form state
  L4: + draft-batch builder + preview/approve-all UI
      + (prasyarat) worker handler create_custom_audience /
        create_lookalike_audience untuk audience intelligence
```

Tidak ada perubahan payload v3 / worker contract di L1–L3. L4 hanya menambah task types yang memang sudah ada di antrian backlog worker.

---

## 7. Guardrails (warisan + tambahan)

Warisan dari endgame.md (berlaku semua):
- Semua write lewat worker_tasks; human approval sebelum duit bergerak; DeepSeek only via `src/lib/llm.ts`.

Tambahan khusus create campaign:
- **PAUSED by default selamanya** — campaign baru SELALU lahir PAUSED; aktivasi adalah aksi terpisah dan eksplisit (tombol sendiri, bukan bagian submit).
- **Agent mengisi, manusia menembak** — capsule/command boleh ngisi 100% form, tapi Submit selalu klik manusia di Review.
- **Budget ceiling per command** — command L4 punya cap total (configurable, default 500rb/hari aggregate); lewat itu butuh approval admin terpisah.
- **Prefill ≠ silent default** — semua field hasil prefill/agent ditandai visual; Review menampilkan sumber tiap nilai ("auto dari produk", "diisi agent", "manual").
- **Clone lintas account wajib re-validate** — pixel/page/audience di-fetch ulang per account target; tidak pernah copy ID mentah lintas account.
- **Placement token belum tervalidasi → warning** — 12 token sisa yang masih inferred kasih badge ⚠ di wizard sampai pernah sukses live (tracking di `meta-placement-map.ts`).

---

## 8. Prioritas Build

### Phase A — L1 prefill (paling murah, paling kerasa)
1. `launch-prefill` endpoint (compose data existing)
2. Step 0 "Mulai dari mana?" + tanda "auto" per field
3. `generate-copy` endpoint (DeepSeek, dari produk + CEP)

### Phase B — L2 template & clone
4. Clone dari list launch (frontend only)
5. `launch_templates` + save/load
6. Clone winner dari Campaign Monitor

### Phase C — L3 capsule wizard
7. Prasyarat: `POST /api/hermes/chat` (Phase 1 endgame.md)
8. Kontrak JSON-patch + AgentCapsule di wizard

### Phase D — L4 command launch
9. Prasyarat: worker `create_custom_audience` / `create_lookalike_audience`
10. Batch draft + preview table + approve-all + progress board

Urutan disengaja: A dan B tidak butuh LLM/infra baru sama sekali — murni nyambungin data yang sudah ada ke wizard yang sudah jalan.

---

*Last updated: 2026-06-12 · Owner: Boy Tenggara · Author: Fable 5 (blueprint), eksekusi per fase via workflow blueprint → Sonnet → audit*
