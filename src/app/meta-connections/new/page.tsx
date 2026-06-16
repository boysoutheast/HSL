'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PageInfo from '@/components/ui/PageInfo'

interface TestResult {
  valid: boolean
  scopes: string[]
  metaUserId: string
  metaUserName: string
  tokenExpiry: string | null
  error?: string
}

const inputCls = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

export default function NewMetaConnectionPage() {
  const router = useRouter()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [appId, setAppId] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [userAccessToken, setUserAccessToken] = useState('')
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [connectionName, setConnectionName] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!appId.trim() || !appSecret.trim() || !userAccessToken.trim()) return

    setTesting(true)
    setTestError(null)
    setTestResult(null)

    try {
      const res = await fetch('/api/admin/meta-connections/test-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          appId: appId.trim(),
          appSecret: appSecret.trim(),
          userAccessToken: userAccessToken.trim(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error ?? `Server error (${res.status})`)
      }

      setTestResult(data)
      if (data.metaUserName) {
        setConnectionName(data.metaUserName)
      }
      setStep(2)
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setTesting(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    setConnectError(null)

    try {
      const res = await fetch('/api/admin/meta-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: connectionName.trim() || testResult?.metaUserName || appId.trim(),
          appId: appId.trim(),
          appSecret: appSecret.trim(),
          userAccessToken: userAccessToken.trim(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login')
          return
        }
        throw new Error(data?.error ?? `Server error (${res.status})`)
      }

      const newId = data.id ?? data.metaAccount?.id
      if (newId) {
        router.push(`/meta-connections/${newId}`)
      } else {
        router.push('/meta-connections')
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Unknown error')
      setConnecting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2">
        <Link href="/system?tab=connections" className="text-sm text-stone-500 hover:text-stone-700">
          Meta Akun
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-stone-900">Hubungkan Baru</span>
      </div>

      <PageInfo
        purpose="Hubungkan akun Meta (Facebook Business + Ads) ke Hermes agar bisa launch campaign dan sinkronisasi aset."
        inputs={[
          'App ID — dari Meta Developer Console',
          'App Secret — dari Meta Developer Console',
          'User Access Token — dari Meta Graph API Explorer',
        ]}
        wiring={[
          { label: '→ Test Launcher', desc: 'Dipakai untuk launch campaign ads' },
          { label: '→ Assets Sync', desc: 'Businesses, Ad Accounts, Pages di-sync otomatis' },
        ]}
      />

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                s < step
                  ? 'bg-violet-600 text-white'
                  : s === step
                  ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-400'
                  : 'bg-stone-100 text-stone-400'
              }`}
            >
              {s < step ? '✓' : s}
            </div>
            <span
              className={`text-sm font-medium ${
                s === step ? 'text-violet-700' : s < step ? 'text-stone-500' : 'text-stone-400'
              }`}
            >
              {s === 1 ? 'Input Credentials' : s === 2 ? 'Review' : 'Connect'}
            </span>
            {s < 3 && <div className="w-8 h-px bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1: Input Credentials */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">Credential Meta</h2>
          <form onSubmit={handleTest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                App ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="Contoh: 1234567890123456"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                App Secret <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder="Contoh: abcdef1234567890abcdef"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                User Access Token <span className="text-red-500">*</span>
              </label>
              <textarea
                value={userAccessToken}
                onChange={(e) => setUserAccessToken(e.target.value)}
                placeholder="Token panjang dari Meta Graph API Explorer (Extended token lebih baik)"
                rows={3}
                required
                className={`${inputCls} resize-none`}
              />
              <p className="text-xs text-stone-400 mt-1">
                Peroleh dari: Graph API Explorer → Permissions: ads_management, business_management, pages_read_engagement, instagram_basic
              </p>
            </div>
            {testError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                ⚠️ {testError}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={testing || !appId.trim() || !appSecret.trim() || !userAccessToken.trim()}
                className="btn-primary"
              >
                {testing ? 'Menguji...' : 'Test Koneksi'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 2 && testResult && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">✓</div>
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Koneksi Valid</h2>
              <p className="text-sm text-stone-500">Credential berhasil diverifikasi dengan Meta API</p>
            </div>
          </div>

          {/* Result Info */}
          <div className="bg-stone-50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Meta User ID</p>
                <p className="font-mono text-stone-800">{testResult.metaUserId}</p>
              </div>
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Meta User Name</p>
                <p className="font-medium text-stone-800">{testResult.metaUserName || '—'}</p>
              </div>
              {testResult.tokenExpiry && (
                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Token Expiry</p>
                  <p className="text-stone-800">
                    {new Date(testResult.tokenExpiry).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>

            {testResult.scopes && testResult.scopes.length > 0 && (
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-2">Scopes</p>
                <div className="flex flex-wrap gap-1.5">
                  {testResult.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="bg-violet-100 text-violet-700 text-xs px-2 py-0.5 rounded-full font-medium"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Custom Name */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Nama Koneksi
              <span className="text-xs text-stone-400 font-normal ml-1">(opsional, default dari Meta User Name)</span>
            </label>
            <input
              type="text"
              value={connectionName}
              onChange={(e) => setConnectionName(e.target.value)}
              placeholder={testResult.metaUserName || appId}
              className={inputCls}
            />
          </div>

          <div className="flex justify-between pt-2">
            <button type="button" onClick={() => setStep(1)} className="btn-ghost">
              ← Kembali
            </button>
            <button type="button" onClick={() => setStep(3)} className="btn-primary">
              Lanjut →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && testResult && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-stone-900">Konfirmasi</h2>

          <div className="bg-stone-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">Nama</span>
              <span className="font-medium text-stone-900">{connectionName || testResult.metaUserName || appId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">App ID</span>
              <span className="font-mono text-stone-800">{appId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Meta User</span>
              <span className="text-stone-800">{testResult.metaUserName || testResult.metaUserId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Scopes</span>
              <span className="text-stone-800">{testResult.scopes?.length ?? 0} permissions</span>
            </div>
          </div>

          {connectError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              ⚠️ {connectError}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button type="button" onClick={() => setStep(2)} className="btn-ghost" disabled={connecting}>
              ← Kembali
            </button>
            <button type="button" onClick={handleConnect} disabled={connecting} className="btn-success">
              {connecting ? 'Menghubungkan...' : 'Hubungkan Meta Akun'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
