# Workflow Standar: Fable → Sonnet → Mac Audit

## 1. Instruksi ke Sonnet (dikirim oleh Fable/Mac)

```
Kamu VPS Sonnet. Eksekusi blueprint berikut:

📄 File: docs/blueprints/[nama]-blueprint.md
Branch: main
Sebelum mulai: git pull --rebase origin main

ATURAN WAJIB:
- Ikuti Execution Order di blueprint, step by step
- tsc --noEmit 0 error sebelum commit
- Setiap file baru: baca pattern existing dulu (auth, prisma, dll)
- Jangan claim DONE sebelum: (1) tsc clean, (2) readback file penting, (3) endpoint test minimal
- No force-push ke main
- Credentials JANGAN ke code/log/commit

SELF-AUDIT setelah selesai (WAJIB):
Kirim SONNET REPORT ke Mac menggunakan format di bawah.
```

---

## 2. SONNET REPORT (format wajib, dikirim ke Mac setelah eksekusi)

```
## SONNET REPORT — [nama blueprint]
Commit: [hash]
Waktu: [durasi]

### DONE
- [✅ item selesai + bukti singkat per item]

### SELF-AUDIT
- tsc: CLEAN / error: [detail]
- Migration: applied [nama] / failed: [error]
- Files dibuat: [list path]
- Files diedit: [list path]
- Endpoint test: [hasil atau "tidak bisa test dari VPS"]

### ISSUES / KEPUTUSAN MANDIRI
- [gap, skip, atau hal yang diputuskan sendiri dengan alasan]

### OUT OF SCOPE / PERLU APPROVAL
- [sesuatu yang ditemukan tapi tidak dikerjain — dilaporin ke Mac]

### SIAP AUDIT MAC ✅
```

---

## 3. MAC FINAL AUDIT (dijalankan Fable setelah terima Sonnet Report)

Checklist:
1. `tsc --noEmit` → 0 error
2. Schema diff DB vs schema.prisma → match
3. Auth: semua route baru pakai `requireAuth` / `validateHermesApiKey`
4. Guards: stop-naming + scope check terpasang di route yang butuh write
5. Contract: endpoint callable, response structure sesuai blueprint
6. No credential di code / commit
7. `git log`: commit bersih, pesan informatif
8. Blueprint objective vs hasil: gap dilaporin, bukan diam-diam di-skip

Output: **MAC AUDIT REPORT** — `DONE` / `PARTIAL` / `FAILED` + next step.

---

## Kapan Fable eksekusi sendiri (bukan Sonnet)?

Hanya jika:
- Task < 5 menit dan trivial (tambah 1 field, fix typo, dll)
- User eksplisit bilang "kamu yang eksekusi"
- Sonnet tidak available / blocked

Default: Fable = arsitektur + blueprint + audit. Sonnet = eksekusi.
