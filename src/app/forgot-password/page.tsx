'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Terjadi kesalahan')
        return
      }

      setSent(true)
    } catch {
      setError('Network error — coba lagi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">AI Buddy</h1>
          <p className="text-stone-400 text-sm mt-1">Reset Password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">📧</div>
              <p className="text-stone-700 font-medium">Cek email Anda</p>
              <p className="text-sm text-stone-500 mt-1">
                Jika email terdaftar, link reset password sudah dikirim.
              </p>
              <Link
                href="/login"
                className="inline-block mt-4 text-violet-600 hover:text-violet-700 text-sm font-medium"
              >
                ← Kembali ke Login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-stone-800 mb-1">
                Lupa Password?
              </h2>
              <p className="text-sm text-stone-500 mb-6">
                Masukkan email Anda. Kami akan kirim link reset password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    placeholder="admin@hermes.local"
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
                  {loading ? 'Mengirim...' : 'Kirim Link Reset'}
                </button>
              </form>

              <p className="text-center text-sm mt-4">
                <Link href="/login" className="text-violet-600 hover:text-violet-700 font-medium">
                  ← Kembali ke Login
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-stone-500 text-xs mt-4">
          AI Buddy Infrastructure · Internal Tool
        </p>
      </div>
    </div>
  )
}
