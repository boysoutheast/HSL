# SONNET TASK — Fix: Rules Button + Bid Strategy

Kamu Sonnet, eksekutor kode. Fix 3 bug di repo `hermes-support-web/`. Jalankan persis, jangan refactor di luar scope.

---

## BUG 1 — `src/app/rules-editor/page.tsx` line 349

Ganti:
```tsx
href="/ads?tab=rules"
```
Jadi:
```tsx
href="/rules-editor/builder"
```

---

## BUG 2+3 — `src/app/test-launches/new/page.tsx`

**Step 1.** Tambah 2 state baru di dekat `bidStrategies` state:
```ts
const [bidStrategiesLoading, setBidStrategiesLoading] = useState(false)
const [bidStrategiesError, setBidStrategiesError] = useState<string | null>(null)
```

**Step 2.** Ganti `fetchBidStrategies` (line ~410–419) dengan:
```ts
const fetchBidStrategies = useCallback(async (adAccountId: string) => {
  if (!adAccountId) { setBidStrategies([]); setBidStrategiesError(null); return }
  setBidStrategiesLoading(true)
  setBidStrategiesError(null)
  try {
    const res = await fetch(`/api/admin/meta-tools/adaccount-capabilities?adAccountId=${adAccountId}`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setBidStrategies(data.bidStrategies ?? [])
    } else {
      const err = await res.json().catch(() => ({}))
      setBidStrategiesError(err.error ?? `Gagal memuat bid strategy (${res.status})`)
      setBidStrategies([])
    }
  } catch {
    setBidStrategiesError('Koneksi gagal. Coba pilih ulang Ad Account.')
    setBidStrategies([])
  } finally {
    setBidStrategiesLoading(false)
  }
}, [])
```

**Step 3.** Di `handleMetaConnectionChange` dan `handleAdAccountChange`, tambahkan di baris yang sama dengan `setBidStrategies([])`:
```ts
setBidStrategiesError(null)
setBidStrategiesLoading(false)
```

**Step 4.** Ganti blok CBO bid strategy render (line ~1132–1178). Inner `{form.metaAdAccountId ? ... : ...}` ganti jadi:
```tsx
{form.metaAdAccountId ? (
  bidStrategiesLoading ? (
    <div className={`${inputCls} bg-stone-50 text-stone-400 flex items-center h-[38px]`}>Memuat strategi...</div>
  ) : bidStrategiesError ? (
    <div className="text-sm text-red-500 flex items-center gap-2">
      <span>{bidStrategiesError}</span>
      <button type="button" onClick={() => fetchBidStrategies(form.metaAdAccountId)} className="text-xs underline text-red-600">Retry</button>
    </div>
  ) : bidStrategies.length > 0 ? (
    <>
      <select
        value={form.bidStrategy}
        onChange={(e) => setForm((f) => ({ ...f, bidStrategy: e.target.value, bidAmount: '', roasAverageFloor: '' }))}
        className={inputCls}
      >
        <option value="">Lowest Cost (default)</option>
        {bidStrategies.filter((b) => b.available).map((bs) => (
          <option key={bs.value} value={JSON.stringify({ strategy: bs.value })}>{bs.label}</option>
        ))}
      </select>
      {form.bidStrategy && (() => {
        const parsed = safeParseJson<Record<string, unknown>>(form.bidStrategy, {})
        if (parsed.strategy === 'COST_CAP' || parsed.strategy === 'BID_CAP') {
          return (
            <div className="mt-2">
              <label className={labelCls}>Bid Amount</label>
              <input type="number" value={form.bidAmount} onChange={(e) => setForm((f) => ({ ...f, bidAmount: e.target.value }))} min="1" step="1" className={inputCls} placeholder="20000" />
              <p className="text-xs text-stone-500 mt-1">Isi angka target bid sesuai currency account.</p>
            </div>
          )
        }
        if (parsed.strategy === 'MIN_ROAS') {
          return (
            <div className="mt-2">
              <label className={labelCls}>ROAS Average Floor</label>
              <input type="number" value={form.roasAverageFloor} onChange={(e) => setForm((f) => ({ ...f, roasAverageFloor: e.target.value }))} min="1" step="1" className={inputCls} placeholder="10000" />
              <p className="text-xs text-stone-500 mt-1">Meta pakai integer. Contoh: 10000 = ROAS 1.0.</p>
            </div>
          )
        }
        return null
      })()}
    </>
  ) : (
    <div className={`${inputCls} bg-stone-50 text-stone-400 flex items-center h-[38px]`}>Tidak ada bid strategy tersedia</div>
  )
) : (
  <div className={`${inputCls} bg-stone-50 text-stone-400 flex items-center h-[38px]`}>Pilih Ad Account terlebih dahulu</div>
)}
```

**Step 5.** Ganti ABO bid strategy render (line ~1248–1280). Hapus `{bidStrategies.length > 0 && (<div>...</div>)}`, ganti dengan:
```tsx
<div>
  <label className={labelCls}>Bid Strategy (opsional)</label>
  {bidStrategiesLoading ? (
    <div className={`${inputCls} bg-stone-50 text-stone-400 flex items-center h-[38px]`}>Memuat...</div>
  ) : bidStrategiesError ? (
    <div className="text-sm text-red-500 flex items-center gap-2">
      <span>{bidStrategiesError}</span>
      <button type="button" onClick={() => fetchBidStrategies(form.metaAdAccountId)} className="text-xs underline text-red-600">Retry</button>
    </div>
  ) : bidStrategies.length > 0 ? (
    <>
      <select value={adset.bidStrategy} onChange={(e) => updateAdsetField(adset.id, 'bidStrategy', e.target.value)} className={inputCls}>
        <option value="">Inherit (default)</option>
        {bidStrategies.filter((b) => b.available).map((bs) => (
          <option key={bs.value} value={JSON.stringify({ strategy: bs.value })}>{bs.label}</option>
        ))}
      </select>
      {adset.bidStrategy && (() => {
        const parsed = safeParseJson<Record<string, unknown>>(adset.bidStrategy, {})
        if (parsed.strategy === 'COST_CAP' || parsed.strategy === 'BID_CAP') {
          return (
            <div className="mt-2">
              <label className={labelCls}>Bid Amount</label>
              <input type="number" value={adset.bidAmount} onChange={(e) => updateAdsetField(adset.id, 'bidAmount', e.target.value)} min="1" step="1" className={inputCls} placeholder="20000" />
              <p className="text-xs text-stone-500 mt-1">Isi angka target bid sesuai currency account.</p>
            </div>
          )
        }
        if (parsed.strategy === 'MIN_ROAS') {
          return (
            <div className="mt-2">
              <label className={labelCls}>ROAS Average Floor</label>
              <input type="number" value={adset.roasAverageFloor} onChange={(e) => updateAdsetField(adset.id, 'roasAverageFloor', e.target.value)} min="1" step="1" className={inputCls} placeholder="10000" />
              <p className="text-xs text-stone-500 mt-1">Meta pakai integer. Contoh: 10000 = ROAS 1.0.</p>
            </div>
          )
        }
        return null
      })()}
    </>
  ) : (
    <div className={`${inputCls} bg-stone-50 text-stone-400 flex items-center h-[38px]`}>Tidak ada bid strategy</div>
  )}
</div>
```

---

## EXECUTION STEPS

```bash
npx tsc --noEmit
# harus zero errors. kalau ada error, fix dulu.

git add src/app/rules-editor/page.tsx src/app/test-launches/new/page.tsx
git commit -m "fix: rules new button href, bid strategy error+loading state"
git push origin main
```

---

## SONNET REPORT (kirim ke Fable setelah selesai)

```
## SONNET REPORT — Bug Fix Rules+BidStrategy
Status: DONE / PARTIAL / FAILED
Commit: <hash>

Bug 1 — New Rule Button: ✅/❌
Bug 2 — CBO Bid Strategy: ✅/❌
Bug 3 — ABO Bid Strategy: ✅/❌

tsc output:
<paste output>

Notes:
<kalau ada masalah>
```
