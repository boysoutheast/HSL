# Runbook F: Cron Deployment + Go-Live Checklist

**Owner:** Boy Tenggara · Status: OPERASIONAL (sebagian config udah ada)
**Tujuan:** Nyalain automation HSL dengan aman. Cron config udah di `railway.toml` — ini verifikasi + go-live gate.

---

## 0. Yang sudah ada
`railway.toml` SUDAH punya 3 cron job: `sync-campaigns` (*/5), `scan-campaigns` (*/5), `topup-campaigns` (*/10), header `x-cron-secret`. Plus cron lama (check-meta-tokens, fetch-metrics, dll). **Config ada — tinggal verify Railway pick up + env bener.**

## 1. Go-Live Gate (JANGAN nyalain automation sebelum semua ✅)
- [ ] Blueprint A (write ownership) merged — write digate ownership, BUKAN env allowlist
- [ ] Blueprint B (cron opt-in) merged — cuma scan automationEnabled=true
- [ ] Blueprint C (token lifecycle) merged — token mati kedeteksi, gak silent
- [ ] Env Railway: `CRON_SECRET` set, `HSL_AUTOMATION_WRITES_ENABLED=true` (kill-switch), `ENCRYPTION_KEY` set (kalau belum — kritikal buat decrypt token)
- [ ] Migration ke-apply (budget_mode, notifications) — auto via Railway `migrate deploy`
- [ ] Smoke 1 campaign real opt-in di 1 ad account owner (PAUSED-safe) end-to-end via cron

## 2. Verifikasi cron jalan
```
1. Railway dashboard → service → Cron → cek 3 job listed + last run sukses
2. Trigger manual / tunggu 1 tick → cek log:
   - sync-campaigns: { synced, failed }
   - scan-campaigns: { scanned, rulesFired, actionsApplied }
   - topup-campaigns: { topped, created }
3. Cek DB: MetricSnapshot kebuat, nextMonitorAt ke-update, AutomationAction muncul
```

## 3. Ramp aman (jangan all-in 2000 user sekaligus)
- Mulai: `HSL_AUTOMATION_WRITES_ENABLED=true` tapi user opt-in manual (automationEnabled per campaign). Natural ramp — cuma yang nyalain yang ke-scan.
- Monitor Admin Overview: actionsApplied, write_failed, akun perlu reconnect.
- Kalau ada masalah → `HSL_AUTOMATION_WRITES_ENABLED=false` (kill-switch, semua write stop, scan/metric tetep jalan).

## 4. Scale tuning (nanti, kalau opted-in campaign > ~300)
- Naikin `scan-campaigns` ke `* * * * *` (1 menit) + batch lebih gede + Promise.all cap konkurensi 5.
- Kalau > ribuan: pertimbangin job-queue (pg-boss) — TAPI itu fase lanjut, bukan sekarang.

## Catatan
Cron services config di Railway dashboard butuh akses owner (Claude MCP token expired). railway.toml jadi sumber, tapi pastiin Railway apply (kadang perlu re-deploy / manual add service).
