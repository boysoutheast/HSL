'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ResetForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Password tidak cocok')
      return
    }

    if (password.length < 8) {
      setError('Password minimal 8 karakter')
      return
    }

    if (!token) {
      setError('Token reset tidak valid')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/admin/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Gagal mereset password')
        return
      }

      setDone(true)
    } catch {
      setError('Network error — coba lagi')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-stone-700 font-medium">Password berhasil direset!</p>
        <p className="text-sm text-stone-500 mt-1">
          Anda sudah login dengan password baru.
        </p>
        <Link
          href="/"
          className="inline-block mt-4 btn-primary px-6 py-2"
        >
          Buka Dashboard
        </Link>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="text-center py-4">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-stone-700 font-medium">Token tidak ditemukan</p>
        <p className="text-sm text-stone-500 mt-1">
          Link reset password tidak valid. Minta link baru.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block mt-4 text-violet-600 hover:text-violet-700 text-sm font-medium"
        >
          Minta Link Baru →
        </Link>
      </div>
    )
  }

  return (
    <>
      <h2 className="text-lg font-semibold text-stone-800 mb-1">
        Buat Password Baru
      </h2>
      <p className="text-sm text-stone-500 mb-6">
        Minimal 8 karakter.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Password Baru
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoFocus
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Konfirmasi Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            ⚠️ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-2.5"
        >
          {loading ? 'Meriset...' : 'Reset Password'}
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">AI Buddy</h1>
          <p className="text-stone-400 text-sm mt-1">Reset Password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <Suspense fallback={null}>
            <ResetForm />
          </Suspense>
        </div>

        <p className="text-center text-stone-500 text-xs mt-4">
          AI Buddy Infrastructure · Internal Tool
        </p>
      </div>
    </div>
  )
}
