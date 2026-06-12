# Blueprint: Launch Prefill (Phase A dari endgame-create-campaign.md)

**Author:** Fable 5 · **Executor:** Sonnet · **Auditor:** Fable 5
**Tanggal:** 2026-06-12 · **Basis:** `docs/endgame-create-campaign.md` §2 + §8 Phase A
**Prinsip:** zero perubahan payload v3 / worker contract. Murni compose data existing + 1 endpoint LLM.

---

## 0. Scope & keputusan FINAL (jangan didebat saat eksekusi)

| Keputusan | Nilai |
|---|---|
| Prefill bersifat saran | SEMUA field hasil prefill bisa di-clear/edit user; tidak ada yang locked |
| Last-used source | `test_launches` milik user itu (`userId`), terbaru by `createdAt`, exclude status `draft` |
| Copy generation | DeepSeek via `llmJson()` dari `src/lib/llm.ts` SAJA. `llmConfigured()` false → endpoint balas 503 `{error:"llm_not_configured"}`, UI skip copy prefill tanpa error blocking |
| Media prefill | max 3 asset `status='READY'` + `productId` match, terbaru dulu. Kosong → field media dibiarkan kosong (bukan error) |
| Landing page | `landing_pages` produk: `isDefault=true` dulu, fallback `isActive=true` pertama |
| Interests | TIDAK di-prefill di Phase A (butuh quality check; masuk Phase C) |
| Step 0 opsi | `Dari Produk` / `Kosong` saja. Template & Clone = Phase B, JANGAN dibuat sekarang |
| Counter karakter copy hasil generate | wajib lolos limit existing: primaryText ≤125, headline ≤255 |

---

## 1. F1 — `GET /api/admin/launch-prefill?productId=<id>`

Auth: `requireAuth` (pattern admin routes existing). Ownership: product harus kebaca user (pakai `ownerFilter` kalau berlaku di model lain — cek pattern accounts route).

Response shape:
```jsonc
{
  "prefill": {
    "campaignName": "Glazingskin - Leads - 12 Jun",   // {product.name} - {objective label} - {tanggal}
    "objective": "OUTCOME_SALES",                      // objective TERBANYAK dari launch produk ini; default OUTCOME_LEADS
    "metaAccountId": "...",                            // last-used (lihat §0)
    "metaAdAccountId": "...",
    "pageId": "...", "igAccountId": "...",
    "pixelId": "...",                                  // last-used; null kalau belum pernah
    "linkUrl": "https://...",                          // landing page produk (§0)
    "media": [ { "id": "...", "fileUrl": "...", "thumbnailUrl": "...", "type": "IMAGE" } ],  // max 3
    "audience": { "ageMin": 25, "ageMax": 45, "gender": "all" },  // dari persona IG account produk kalau ke-link; else default ini
    "sources": {                                       // per key di atas: dari mana nilainya
      "campaignName": "auto", "objective": "history", "linkUrl": "landing_page", ...
    }
  }
}
```

Catatan audience: produk → IG account nggak punya relasi langsung; ambil via `contentLogs`/`mediaAssets` yang nge-link produk↔account itu KALAU gampang; kalau join-nya ribet, pakai default `{25,45,all}` dengan source `"default"` — JANGAN bikin migration/relasi baru.

## 2. F2 — `POST /api/admin/meta-tools/generate-copy`

Body: `{ "productId": "...", "objective": "OUTCOME_SALES", "tone": "soft_selling" | "hard_selling" | "edukasi" }` (tone optional, default soft_selling).

Implementasi:
1. Ambil product (name, description, mainBenefit, ingredients, usageInstruction) + max 5 CEP aktif produk itu (`ceps` by productId, status active, terbaru).
2. `llmJson<{variants: Array<{primaryText, headline, description}>}>(system, user)` — minta **3 variant** sekaligus, bahasa Indonesia, hard constraint di prompt: primaryText ≤125 char, headline ≤40 char (optimal display), description ≤30 char.
3. Server-side enforce: variant yang primaryText >125 / headline >255 → truncate di word boundary + tandai `"truncated": true`.
4. Response: `{ "variants": [...] }`. LLM error → 502 `{error}` jelas, UI graceful.

## 3. F3 — Wizard: Step 0 + tanda "auto"

File: `src/app/test-launches/new/page.tsx`.

1. **Step 0 "Mulai dari mana?"** — tampil sebelum step Campaign HANYA saat form masih pristine:
   - Kartu `🛍 Dari Produk`: dropdown produk aktif (`GET /api/admin/products` existing) → pilih → call F1 → patch form state → langsung ke step Campaign
   - Kartu `✏️ Kosong`: langsung ke step Campaign (perilaku sekarang)
   - Step indicator existing JANGAN diubah jadi 5 step — Step 0 itu overlay/gate, bukan step baru
2. **Tanda "auto"**: setiap field yang nilainya dari prefill dapet badge kecil `auto` (atau `auto · history` dst dari `sources`) di sebelah label; user edit field itu → badge hilang. Simpan map `prefilledKeys` di state, jangan bikin struktur form baru.
3. **Tombol "✨ Generate copy"** di tiap creative (step Ads): call F2, tampil 3 variant sebagai pilihan klikable → klik = isi primaryText/headline/description creative itu. productId diambil dari pilihan Step 0; kalau wizard mulai dari Kosong → tombol disabled dengan tooltip "mulai dari produk untuk generate copy".
4. Prefill media: masuk sebagai creative pertama (atau N creative kalau >1 media? TIDAK — 1 creative pertama pakai media[0], sisanya muncul preselected di picker; keputusan final).

## 4. Aturan eksekusi

1. Urutan: F1 → F2 → F3. Build hijau + commit per fase, push di akhir.
2. TIDAK ada migration di blueprint ini. Kalau lo merasa butuh → STOP, DEVIATION + lapor dulu.
3. TIDAK menyentuh: POST test-launches, approval payload, worker.
4. DeepSeek only (`src/lib/llm.ts`). Dilarang panggil provider lain.
5. No force-push.

## 5. Acceptance (produksi, login sekali)

1. `GET launch-prefill?productId=<produk real>` → 200, shape sesuai §1, `sources` keisi.
2. productId ngaco → 404. Tanpa auth → 401.
3. `POST generate-copy` produk real → 200, 3 variants, semua primaryText ≤125. (LLM down → 502 graceful, catat.)
4. UI: buka /test-launches/new → Step 0 muncul; pilih produk → form keisi + badge auto; edit satu field → badge field itu hilang.
5. Mulai dari Kosong → wizard persis perilaku lama (regresi guard).
6. Generate copy → 3 variant tampil, klik → keisi ke creative.
7. Submit launch hasil prefill end-to-end → draft kebuat (JANGAN approve; cukup POST 201 — write path udah terbukti, jangan nambah objek Meta).
8. Cleanup row test (draft boleh via API delete) → readback 0 sisa.

---

*Hasil + bukti per acceptance balik ke auditor.*
