# Blueprint — Fix Entry-Point Koneksi Meta (OAuth + Manual) yang "Ilang"

**Owner:** Boy · **Author:** Fable · **Executor:** Sonnet (VPS) · **Date:** 2026-06-19
**Repo:** hermes-support-web · **Goal:** Balikin akses UI buat NYAMBUNGIN akun Meta (OAuth & manual). Page & API udah ada, cuma yatim (gak di-link).

---

## 0. TEMUAN AUDIT (akar masalah)

Yang udah ADA & jalan (JANGAN bikin ulang):
- `/meta-connections/new` — wizard manual 3-step LENGKAP (App ID → App Secret → User Token → `POST /api/admin/meta-connections/test-credentials` → simpan `POST /api/admin/meta-connections`). Terverifikasi.
- `/meta-connections` (list) + `/meta-connections/[id]` (detail) — ada.
- OAuth: `GET /api/admin/meta-oauth/start` (redirect ke Facebook) + `/callback` — jalan.

🔴 **Masalah:** `src/app/system/ConnectionsTab.tsx` section "🔗 Meta Connections" (≈line 270–308):
- Empty state (line 276–277) = teks buntu `"Belum ada akun Meta terhubung."` — **TANPA tombol connect**.
- Satu-satunya pemicu OAuth = link "Hubungkan Ulang" (line 297–302) yang **cuma muncul kalau ada koneksi existing status `needs_reconnect`/`expired`**.
- `/meta-connections/new` (manual) **gak di-link dari mana pun** (grep se-repo: 0 referensi nav).
→ User dengan 0 koneksi / mau nambah akun = **buntu, gak ada jalan connect**.

(Catatan: `GET /api/admin/connections/meta` sengaja gak return `appId` — itu poin sekunder, dihandle di §2 opsional.)

---

## 1. FIX UTAMA — entry point di ConnectionsTab Meta section (WAJIB)

File: `src/app/system/ConnectionsTab.tsx`, section "🔗 Meta Connections".

### 1.1 Header section: tambah 2 tombol (selalu tampil)
Di sebelah/bawah `<h3>🔗 Meta Connections</h3>` + deskripsi, tambah baris aksi:
- **Tombol primer "➕ Hubungkan Meta"** → `<a href="/api/admin/meta-oauth/start">` (OAuth, cara termudah). Style `btn-primary btn-sm`.
- **Link sekunder "Tambah manual"** → `<Link href="/meta-connections/new">` (wizard App ID/Secret/Token yang udah ada). Style `btn-ghost btn-sm` / underline kecil.
- Kasih `<HelpHint>` opsional: OAuth = tercepat, manual = kalau udah punya App ID/Secret/long-lived token sendiri.

### 1.2 Empty state: ganti dead-end jadi CTA
Line 276–277 — ganti teks polos jadi empty-state ber-aksi:
```
Belum ada akun Meta terhubung.
[➕ Hubungkan Meta]  [Tambah manual]
```
(reuse tombol §1.1; jangan biarin cuma teks).

### 1.3 Per-koneksi: tetap ada "Hubungkan Ulang" (existing, jangan dihapus)
Logic line 297–302 dipertahankan (reconnect saat needs_reconnect/expired).

> Import yang mungkin perlu: `import Link from 'next/link'` (kalau belum ada di file).

---

## 2. OPSIONAL (sekunder — poin appId Sonnet)

Kalau mau sekalian munculin App ID + akses detail:
### 2.1 Backend `src/app/api/admin/connections/meta/route.ts`
Tambah `appId: a.appId` di object map (line ~31-45). (Field `MetaAccount.appId` ADA di DB. App Secret JANGAN di-return — tetap rahasia.)
### 2.2 UI
Tampilin `{c.appId}` kecil di bawah nama koneksi + bikin nama/koneksi link ke `/meta-connections/{c.id}` (detail). Tipe `MetaConnection` di ConnectionsTab tambah `appId?: string`.

---

## 3. ACCEPTANCE
1. `npx tsc --noEmit` clean · `npm run build` exit 0.
2. Section Meta Connections SELALU punya tombol "➕ Hubungkan Meta" (OAuth) + "Tambah manual" — termasuk pas 0 koneksi.
3. Klik "Hubungkan Meta" → redirect ke `/api/admin/meta-oauth/start` (→ Facebook).
4. Klik "Tambah manual" → buka `/meta-connections/new` (wizard jalan).
5. Gak ada endpoint/page baru dibuat (cuma re-link + tombol). App Secret gak pernah ke-return ke client.
6. (Kalau §2 dikerjain) appId tampil, App Secret TIDAK.

---

## 4. SMOKE LIVE (setelah deploy)
- **S1** `/system?tab=connections` (akun dengan 0 koneksi Meta / atau lihat empty state) → tombol "➕ Hubungkan Meta" + "Tambah manual" KELIHATAN. Screenshot.
- **S2** Klik "➕ Hubungkan Meta" → ke-redirect ke dialog OAuth Facebook (client_id muncul). Screenshot URL.
- **S3** Klik "Tambah manual" → `/meta-connections/new` step 1 kebuka. Screenshot.
- **S4** (kalau §2) koneksi existing nampilin appId, App Secret gak ada di response (cek network tab `/api/admin/connections/meta` — gak ada `appSecret`).
Jujur tandai visual vs build-only.

---

## 5. EKSEKUSI & LAPORAN (audit murah)
- Branch `feat/meta-connection-entrypoint`. Commit per fase. Jangan merge sendiri.
- DILARANG: bikin page/endpoint baru (semua udah ada), return App Secret ke client, ubah API path.

**LAPOR (paste mentah):**
1. `git diff --stat origin/main...HEAD` (harus cuma ConnectionsTab.tsx [+ connections/meta route kalau §2])
2. `grep -n 'meta-oauth/start\|meta-connections/new' src/app/system/ConnectionsTab.tsx` (buktiin 2 entry point ke-link)
3. `grep -rn 'appSecret' src/app/api/admin/connections/meta/route.ts` (harus 0 — secret gak bocor)
4. `npx tsc --noEmit` + `npm run build` (10 baris akhir)
5. Smoke S1–S4: PASS/FAIL + screenshot
6. STATUS

Klaim PASS wajib bukti. Jujur.

---

## 6. Catatan
- Murni UI re-link — resiko rendah, gak ada backend baru (kecuali §2 = 1 baris appId).
- JANGAN ekspos App Secret. OAuth jalur utama (termudah), manual buat power user.
- Self-contained: line number + endpoint + page semua di sini.
```
