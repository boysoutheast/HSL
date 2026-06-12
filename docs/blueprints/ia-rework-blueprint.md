# Blueprint: IA Rework 5 Pilar + Media Library + Dashboard + Influencer v1

**Author:** Fable 5 · **Executor:** Sonnet · **Auditor:** Fable 5 · **Tanggal:** 2026-06-12
**Basis:** desain approved owner (5 pilar, dashboard user-focused, media library drawer)
**Mode:** end-to-end — semua fase dikerjakan sampai kelar dalam satu rangkaian.

---

## ⚠️ 0. ATURAN DB — BACA DULU, INI YANG PALING PENTING

**Blueprint ini TIDAK BUTUH perubahan schema/DB sama sekali. Zero migration.**

- Semua fase = UI + routing + query Prisma read-only terhadap tabel existing.
- Kalau di tengah jalan lo merasa butuh `ALTER TABLE` / model baru / kolom baru → **STOP. Itu tanda lo salah desain.** Lapor dengan prefix DEVIATION, jangan eksekusi.
- DILARANG: drop/rename tabel, drop/rename kolom, hapus row, ubah seed, sentuh `prisma/migrations/`.
- DILARANG menghapus route API apapun (`/api/admin/*`, `/api/hermes/*`, `/api/worker/*`, `/api/internal/*`, `/api/cron/*`) — Hermes agents + worker + cron masih makai semuanya.
- Halaman lama yang "hilang" dari menu = di-redirect, BUKAN dihapus filenya dulu (file lama boleh dihapus HANYA kalau route barunya sudah terbukti jalan di fase yang sama).

## 0b. Keputusan FINAL (jangan didebat)

| Hal | Keputusan |
|---|---|
| Pilar (urutan) | Dashboard · Ads · Influencer · Media · System |
| Approvals menu | hilang dari nav; approve flow jadi dialog inline di detail launch (backend approval_requests TETAP dipakai, cuma UI-nya pindah) |
| Settings menu | hilang; link "Ganti password" masuk dropdown profil user di sidebar footer |
| "Test Launches" | rename label UI jadi "Launches" — route file & API path TIDAK diganti (cuma label + redirect alias `/launches` → halaman existing) |
| Media Rules | menunya hilang; halamannya jadi tab "Media Rules" di dalam Ads → Rules |
| Characters menu | hilang dari nav (data persona sudah di IG account); halaman `/characters` redirect ke Influencer roster |
| OAuth IG / Threads + Content Engine generate | **OUT OF SCOPE** — pilar Influencer v1 cuma reorganisasi data existing. Jangan dibuat. |
| ⌘K command bar | v1 = search navigasi + entitas (campaign/akun/media by name) saja. TANPA natural language command. |
| Bahasa label | konsisten Indonesia kecuali istilah teknis (Launch, Rules, dll — ikut existing) |

---

## F1 — IA 5 Pilar (sidebar + routing + redirect)

1. `Sidebar.tsx` rework total jadi 5 pilar:
   - `⌂ Dashboard` → `/`
   - `▲ Ads` → `/ads` (tab: Launch · Monitor · Rules · Actions)
   - `✦ Influencer` → `/influencer` (tab: Roster · dst di F4)
   - `▣ Media` → `/media` (tab: Library · Products · Generate)
   - `⚙ System` → `/system` (tab: Connections · Agents · Workers · Users · Docs) — adminOnly section tetap dihormati
2. Pilar = layout dengan tab horizontal (komponen tab shared, bikin sekali pakai semua). Konten tab = komponen halaman existing yang DIPINDAH (import komponennya, bukan rewrite).
   Mapping: Launch ← test-launches(+new), Monitor ← campaign-monitor, Rules ← rules-editor + media-rules (2 sub-tab), Actions ← action-center; Library ← media-library, Products ← products; Connections ← meta-connections, Agents ← agents, Workers ← workers + admin/dead-letters + observability (3 sub-tab), Users ← admin-users, Docs ← docs.
3. SEMUA route lama tetap hidup sebagai redirect (next.config redirects atau page stub `redirect()`): `/test-launches` → `/ads?tab=launch`, `/media-library` → `/media?tab=library`, `/characters` → `/influencer`, dst — daftar lengkap semua route nav lama wajib ke-cover.
4. Tombol **"+ Buat"** global (top bar / floating di sidebar atas): dropdown 3 aksi → New Launch (`/ads?tab=launch&new=1`), Upload Media (`/media?tab=library&upload=1`), (Generate Konten = disabled, tooltip "coming soon").
5. Badge count di pilar: Ads = jumlah approval_requests status pending + action center pending (query ringan via 1 endpoint baru `GET /api/admin/nav-badges` — endpoint BOLEH, migration TIDAK); Influencer = jumlah akun posting monitor READY_UPLOAD. Polling 60s.

## F2 — Media Library redesign (`/media?tab=library`)

1. Layout: toolbar (search + chip filter: Semua/Foto/Video/READY/Belum dipakai + tombol Upload) · grid thumbnail · drawer detail kanan.
2. Grid: sel pertama SELALU kartu "✨ Generate dari produk" → buka tab Generate (F2.5). Item: thumbnail, badge status (READY hijau / GENERATING ungu / DIPAKAI n× amber), badge ▶ untuk video.
3. Koleksi otomatis per produk: section header per productId (+ "Tanpa produk"). Bukan folder manual.
4. Drawer detail (klik asset): preview besar, label, produk, **Dipakai di** (join: `test_launch_creatives` yang imageUrl/fileUrl match + `generated_content_logs` kalau ada relasi mediaAssetId/photoReferenceId — cek schema, pakai yang ADA, jangan nambah kolom), aksi: "→ Pakai di Ads" (buka wizard prefill media), Arsip (PATCH status existing), hapus.
5. Upload: drag & drop multi-file ke grid (pakai endpoint upload existing), bulk set produk + label.
6. Tab Generate (v1 minimal): list worker_tasks type GENERATE_PHOTO/GENERATE_VIDEO + status + tombol "Buat task generate" (form: produk + brief → POST worker task via endpoint existing kalau ada; kalau endpoint create-task admin belum ada → tampilkan "via Hermes agent" placeholder, JANGAN bikin endpoint write baru tanpa lapor).

## F3 — Dashboard user-focused (`/`)

1. Header 4 kartu: Spend hari ini · ROAS blended · Campaign aktif · Butuh keputusan (amber). Sumber: data campaign-monitor/insights existing — kalau insights belum tersedia di DB, tampilkan "—" dengan label "data menyusul", JANGAN fake angka.
2. Seksi "⚡ Butuh keputusan": list dari action center / approval pending — tiap item: judul situasi, konteks, tombol aksi existing (approve/dismiss memanggil endpoint existing).
3. Seksi "✦ Influencer hari ini": dari posting monitor — posted (dengan views kalau ada) / generating / READY tapi kosong. Max 5 + link "lihat semua".
4. Footer: ⌘K bar + indikator "● worker sehat/mati" dari worker_registry (heartbeat < 120s = sehat) — satu titik + link ke System, bukan panel.
5. ⌘K command palette: fuzzy search nama campaign (test_launches), IG account, media label, produk → navigate. Library kecil atau hand-rolled, jangan tambah dependency berat.
6. Scope per user: semua query dashboard hormati `ownerFilter`/userId pattern existing (admin lihat semua).

## F4 — Influencer v1 (`/influencer`)

1. **Roster**: grid kartu per IG account — avatar (foto referensi pertama), @username, gender badge, persona completeness (komponen existing dari accounts list), status posting monitor, last post. Klik → profil.
2. **Profil** (`/influencer/[id]`): rework dari halaman account detail existing — header + tab: Persona (existing) · Konten (topics & CEP akun itu, pindahan dari halaman topics filter by account) · Riwayat (content logs akun itu + status posting) · Foto (existing).
3. Halaman `/accounts` & `/topics` lama → redirect ke sini. Topics & CEP global view tetap bisa diakses dari Influencer → tab "Semua Topik" (pindahan halaman topics utuh).
4. JANGAN bikin: OAuth connect, auto-posting scheduler, generate konten. Tab "Content Engine" = placeholder "coming soon" satu kalimat.

## F5 — Cleanup + polish

1. Hapus menu/halaman yang sudah ter-redirect & terbukti: approvals page (logic approve dipindah inline ke detail launch di Ads → Launch), settings page (ganti password → dropdown profil).
2. Audit semua link internal (`href=`) yang masih nunjuk route lama → update ke route baru (redirect tetap dipasang buat bookmark user).
3. Docs page (`/system?tab=docs`): update referensi menu/path yang berubah.
4. Dark mode: JANGAN aktifkan (keputusan lama — light only).

---

## Urutan & disiplin eksekusi

| Fase | Verify |
|---|---|
| F1 | build hijau + semua redirect lama 200→halaman baru (curl list) + nav-badges endpoint 200 |
| F2 | build + buka /media: grid, drawer, koleksi, upload jalan di prod |
| F3 | build + dashboard: 4 kartu render (boleh "—"), butuh-keputusan klik jalan, ⌘K navigate |
| F4 | build + roster render semua akun + profil tab lengkap + redirect accounts/topics |
| F5 | build + zero link mati (grep href route lama) |

- Commit per fase, push per fase (biar Railway deploy bertahap & bisa rollback per fase).
- Login prod SEKALI, reuse cookie.
- DEVIATION rule: penyimpangan apapun → prefix `DEVIATION:` di commit + lapor.
- No force-push.

## Acceptance final (setelah F5, di produksi)

1. Sidebar = 5 pilar + "+ Buat" + badge. Tidak ada menu lama tersisa.
2. 12+ route lama (daftar F1.3) semua redirect benar.
3. Launch flow end-to-end masih jalan: buat draft via wizard dari "+ Buat" → 201 (draft saja, JANGAN approve).
4. `/api/hermes/library` + `/api/worker/tasks` + cron endpoints → response shape TIDAK berubah (diff vs sebelum).
5. Media drawer "Dipakai di" menampilkan data real untuk minimal 1 asset.
6. Dashboard badge "Butuh keputusan" angkanya match count query manual.
7. worker_registry dot = hijau (heartbeat hidup).
8. Cleanup row test yang dibuat selama acceptance → readback 0 sisa.
9. `SELECT COUNT(*)` semua tabel utama (test_launches, media_assets, instagram_accounts, topics, ceps, products) SAMA persis sebelum vs sesudah seluruh rework — bukti DB nggak kesentuh.

---

*Laporan per fase + acceptance final + daftar DEVIATION balik ke auditor.*
