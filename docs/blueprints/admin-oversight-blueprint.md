# Blueprint: Admin Oversight Panel — System Control buat Owner

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION (Sonnet)
**Estimasi:** 3–4 jam · UI + read endpoints, NO schema baru (semua data udah ada)
**Tujuan:** Admin (owner) bisa lihat keseluruhan sistem — siapa user-nya, ngapain, saldo berapa, pakai berapa — dalam UI ramah & gampang. Bukan observability teknis worker (itu udah dihapus), tapi **business oversight SaaS**.

---

## 1. Apa yang admin BUTUH tau (hasil mikir)

### Tentang tiap user
| Butuh tau | Sumber data (udah ada) |
|---|---|
| Siapa: email, nama, role, status, kapan daftar, kapan terakhir aktif | AdminUser (email, name, role, status, createdAt, lastLoginAt) |
| Uang: saldo sekarang, total di-grant, total kepakai, riwayat | AdminUser.creditBalance + CreditTransaction (ledger) |
| Aktivitas: berapa video di-generate (sukses/gagal), berapa campaign (jalan) | GeneratedMedia, CampaignSession |
| Spend Meta: total belanja iklan | MetricSnapshot (spend) |
| Akses: berapa API key, kapan terakhir dipakai | UserApiKey (lastUsedAt) |
| Koneksi: akun Meta nyambung berapa | MetaAccount / MetaAdAccount |

### Tentang sistem keseluruhan (helicopter view)
- Total user (active vs pending) — **pending = butuh approve, actionable**
- Total saldo beredar (sum creditBalance semua user) = liability
- Kredit kepakai 30 hari (dari ledger, sum debit)
- Video di-generate 30 hari + success rate
- Campaign RUNNING total + total Meta spend 30 hari
- Feed aktivitas terbaru: signup baru, konsumsi kredit gede, generation gagal
- Alert: pending approval, user saldo 0, lonjakan job gagal

### Aksi yang admin perlu lakuin
- Approve user pending
- Grant kredit (udah ada `/api/admin/credits/grant`)
- Suspend / aktifkan user
- Ganti role (user ↔ admin)
- Revoke API key user (kalau abuse)

---

## 2. Struktur: Admin System = 3 tab

| Tab | Isi | Role |
|---|---|---|
| **Overview** | KPI sistem + alert + activity feed | Admin only |
| **Users** | Tabel user → drawer detail per-user | Admin only |
| **Connections** | Meta OAuth + API key (self) — yang udah ada | Semua |

(meta/hash-checker yang sempat ditambah → fold: Meta OAuth masuk Connections, hash-checker jadi tool sekunder di Overview kalau masih dipakai, atau hapus kalau gak. Konfirmasi owner.)
User biasa: System cuma **Connections** (gak lihat Overview/Users).

---

## 3. Endpoints (read-only + aksi, semua requireAdmin)

### 3.1 `GET /api/admin/overview` — KPI sistem
```
requireAdmin. Aggregate (hindari N+1 — pakai groupBy/count/aggregate):
{
  users: { total, active, pending, suspended },
  credits: { outstanding (sum balance), consumed30d (sum |debit| ledger), granted30d },
  videos: { total30d, succeeded30d, failed30d, successRate },
  campaigns: { running, total },
  spend30d: (sum MetricSnapshot.spend window 30d),
  alerts: { pendingApprovals: n, zeroBalanceUsers: n },
  recentActivity: [ {type:'signup'|'big_spend'|'gen_failed'|'new_campaign', userEmail, detail, at} ] // limit 20
}
```

### 3.2 `GET /api/admin/admin-users` — enhance yang udah ada
Tambah ke response per user: `creditBalance`, `lastLoginAt`, `_count: { campaignSessions, generatedMedia, apiKeys }`. Query: `?status=&role=&q=<email/nama>&sort=balance|recent&limit=&offset=`.

### 3.3 `GET /api/admin/admin-users/[id]` — detail 1 user
```
requireAdmin. Return:
{
  user: { id, email, name, role, status, creditBalance, lastLoginAt, createdAt },
  credits: { balance, granted (sum), consumed (sum), transactions: [...last 20] },
  usage: {
    videos: { total, completed, failed },
    campaigns: { total, running },
    apiKeys: [ {prefix, status, lastUsedAt} ],
    metaAccounts: n,
    spendAllTime
  }
}
```

### 3.4 `PATCH /api/admin/admin-users/[id]` — aksi admin
```
requireAdmin. Body salah satu: { status: 'active'|'suspended'|'pending' } | { role: 'user'|'admin' }
Guard: admin GAK BISA suspend / demote dirinya sendiri (cegah lock-out) → 422.
Audit: catat siapa yang ngubah (log/console minimal).
```

### 3.5 Grant kredit — pakai `/api/admin/credits/grant` yang udah ada (body userId + amount).
### 3.6 Revoke key user — `DELETE /api/admin/admin-users/[id]/api-keys/[keyId]` (set status revoked).

---

## 4. UI/UX — ramah & gampang (kunci permintaan owner)

### 4.1 Overview tab
```
┌ 6 KPI card (grid) ──────────────────────────────────────────┐
│ 👥 Users      💰 Saldo beredar   🔥 Kredit kepakai 30d       │
│ 142 (8 pending)  Rp 4,2jt          1,3jt kredit              │
│ 🎬 Video 30d   🚀 Campaign jalan  📊 Spend 30d              │
│ 320 (94% ok)    47                 Rp 89jt                   │
└──────────────────────────────────────────────────────────────┘

┌ ⚠️ Perlu tindakan ──────────────────────────────────────────┐
│ 8 user nunggu approve            → [Lihat]                   │
│ 3 user saldo 0                   → [Lihat]                   │
└──────────────────────────────────────────────────────────────┘

┌ Aktivitas terbaru ──────────────────────────────────────────┐
│ 🆕 14:30  budi@x.com daftar                                  │
│ 🔥 14:10  sari@y.com pakai 13rb kredit (10 video)           │
│ ⚠️ 13:55  joni@z.com — 2 generation gagal                   │
└──────────────────────────────────────────────────────────────┘
```
- Angka gede, label bahasa manusia (bukan jargon). Card pending = kuning, klik → filter Users ke pending.

### 4.2 Users tab
```
[🔍 cari email/nama]  [status ▾] [role ▾] [urut: saldo ▾]      142 user

┌──────────────────────────────────────────────────────────────┐
│ 👤 Budi  budi@x.com   user   🟢active  Rp45rb  3 camp  aktif 2j│
│ 👤 Sari  sari@y.com   user   🟡pending  Rp0     0 camp  —      │ → [Approve]
│ 👤 Joni  joni@z.com   admin  🟢active  Rp1,2jt 12 camp aktif 5m│
└──────────────────────────────────────────────────────────────┘
```
- Klik row → **drawer kanan** (gak pindah halaman — cepet):
```
┌ Budi · budi@x.com ──────────────────────── [×] ┐
│ user · 🟢 active · daftar 12 Jun · aktif 2j lalu │
│                                                   │
│ 💰 Saldo: Rp 45.000      [+ Grant kredit]        │
│    di-grant 1,3jt · kepakai 1,25jt                │
│    ▸ riwayat transaksi (10 terakhir)             │
│                                                   │
│ 📊 Pemakaian                                      │
│    🎬 18 video (16 ok, 2 gagal)                   │
│    🚀 3 campaign (1 jalan)                         │
│    🔑 2 API key (terakhir dipakai 1j)             │
│    🔗 1 akun Meta · spend Rp 12jt                 │
│                                                   │
│ Aksi: [Suspend] [Jadikan admin] [Revoke key]     │
└───────────────────────────────────────────────────┘
```
- Approve pending = 1 klik dari row atau drawer.
- Grant kredit = modal kecil (jumlah + alasan) → POST grant → refresh.
- Self-guard: tombol Suspend/demote **disabled** di akun admin sendiri.

### 4.3 Prinsip UX
- Drawer > halaman baru (cepet, konteks gak ilang).
- Bahasa Indonesia manusiawi, angka Rp diformat (jt/rb).
- Aksi destruktif (suspend/revoke) → confirm kecil.
- Empty/loading state jelas. Polling Overview 60s.

---

## 5. Acceptance
- [ ] Admin System: Overview + Users + Connections. User biasa cuma Connections.
- [ ] Overview: 6 KPI akurat (cross-check manual 1 angka ke DB), alert pending, activity feed
- [ ] Users: search/filter/sort, row → drawer detail
- [ ] Drawer: profil, saldo+grant+riwayat, pemakaian (video/campaign/key/meta/spend), aksi
- [ ] Approve pending, suspend/activate, ganti role, grant, revoke key — jalan
- [ ] Self-guard: admin gak bisa suspend/demote diri sendiri (422)
- [ ] Semua endpoint requireAdmin, user biasa 403
- [ ] Angka aggregate gak N+1 (groupBy/aggregate), enteng buat 2000 user
- [ ] tsc 0 error · /docs admin section update

## 6. Execution Order
```
1. GET /api/admin/overview (aggregate)
2. Enhance GET /api/admin/admin-users (+counts +balance +filter/sort)
3. GET /api/admin/admin-users/[id] (detail)
4. PATCH /api/admin/admin-users/[id] (status/role + self-guard) + DELETE api-keys/[keyId]
5. UI: System Overview tab (KPI + alert + feed)
6. UI: Users tab (tabel + search/filter) + drawer detail + aksi
7. /docs + tsc · commit per fase · push (branch sama: feat/hsl-independent-rework)
```

## Aturan Wajib
- NO schema baru — semua dari tabel existing. requireAdmin semua endpoint.
- Aggregate efisien (count/groupBy/aggregate), JANGAN loop per-user fetch (2000 user = mati).
- Self-guard admin. Tenant: ini admin-global (boleh lihat semua), tapi endpoint WAJIB requireAdmin (user biasa 403).
- White-label tetap. tsc 0 error. No force-push. JANGAN claim DONE tanpa cross-check 1 angka KPI ke DB.
```
