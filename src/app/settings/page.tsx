'use client'

import { useEffect, useState } from 'react'
import PageInfo from '@/components/ui/PageInfo'

interface Settings {
  id?: string
  checkIntervalMinutes: number
  minimumDecisionAgeMinutes: number
  deadEarlyAgeMinutes: number
  stuckThresholdPercentPerHour: number
  growingThresholdPercentPerHour: number
  hotThresholdPercentPerHour: number
  stuckConfirmationCount: number
  hotLockDurationMinutes: number
  maxPostPerDay: number
  minimumGapUploadMinutes: number
}

const FIELD_META: {
  key: keyof Settings
  label: string
  description: string
  type: 'integer' | 'float'
  unit: string
}[] = [
  {
    key: 'checkIntervalMinutes',
    label: 'Check Interval',
    description: 'How often the posting monitor checks each account for new metrics. Lower = more frequent checks.',
    type: 'integer',
    unit: 'minutes',
  },
  {
    key: 'minimumDecisionAgeMinutes',
    label: 'Minimum Decision Age',
    description: 'Minimum age of a post before the monitor makes a READY_UPLOAD / NEED_NEW_VIDEO decision.',
    type: 'integer',
    unit: 'minutes',
  },
  {
    key: 'deadEarlyAgeMinutes',
    label: 'Dead Early Age',
    description: 'If views are very low after this many minutes, the post is classified as dead early.',
    type: 'integer',
    unit: 'minutes',
  },
  {
    key: 'stuckThresholdPercentPerHour',
    label: 'Stuck Threshold',
    description: 'Growth rate below this % per hour means the video is considered stuck.',
    type: 'float',
    unit: '%/hr',
  },
  {
    key: 'growingThresholdPercentPerHour',
    label: 'Growing Threshold',
    description: 'Growth rate above this % per hour means the video is still growing — hold off posting.',
    type: 'float',
    unit: '%/hr',
  },
  {
    key: 'hotThresholdPercentPerHour',
    label: 'Hot Threshold',
    description: 'Growth rate above this % per hour means the video is HOT — lock account and do not disturb.',
    type: 'float',
    unit: '%/hr',
  },
  {
    key: 'stuckConfirmationCount',
    label: 'Stuck Confirmation Count',
    description: 'How many consecutive stuck checks before triggering READY_UPLOAD status.',
    type: 'integer',
    unit: 'checks',
  },
  {
    key: 'hotLockDurationMinutes',
    label: 'Hot Lock Duration',
    description: 'How long to lock a HOT_VIDEO account before re-evaluating.',
    type: 'integer',
    unit: 'minutes',
  },
  {
    key: 'maxPostPerDay',
    label: 'Max Posts Per Day',
    description: 'Maximum number of posts allowed per account per day.',
    type: 'integer',
    unit: 'posts/day',
  },
  {
    key: 'minimumGapUploadMinutes',
    label: 'Minimum Upload Gap',
    description: 'Minimum time gap between posts for a single account.',
    type: 'integer',
    unit: 'minutes',
  },
]

const DEFAULT_SETTINGS: Settings = {
  checkIntervalMinutes: 60,
  minimumDecisionAgeMinutes: 180,
  deadEarlyAgeMinutes: 120,
  stuckThresholdPercentPerHour: 3,
  growingThresholdPercentPerHour: 10,
  hotThresholdPercentPerHour: 20,
  stuckConfirmationCount: 2,
  hotLockDurationMinutes: 360,
  maxPostPerDay: 2,
  minimumGapUploadMinutes: 360,
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) setSettings(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (key: keyof Settings, value: string) => {
    const meta = FIELD_META.find((f) => f.key === key)
    const parsed = meta?.type === 'float' ? parseFloat(value) : parseInt(value, 10)
    setSettings((prev) => ({ ...prev, [key]: isNaN(parsed) ? 0 : parsed }))
    setSaved(false)
  }

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS)
    setSaved(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Loading settings...
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Posting Monitor configuration parameters.</p>
      </div>

      <PageInfo
        purpose="Atur rules kapan akun dianggap stuck, growing, atau hot. Semua angka ini dipakai cron posting monitor untuk kalkulasi status."
        inputs={[
          'Check interval (menit)',
          'Minimum decision age (menit)',
          'Dead early age (menit)',
          'Stuck threshold % per jam',
          'Growing threshold % per jam',
          'Hot threshold % per jam',
          'Stuck confirmation count',
          'Hot lock duration (menit)',
          'Max post per day',
          'Minimum gap upload (menit)',
        ]}
        wiring={[
          { label: '→ Cron posting-monitor', desc: 'setting ini dibaca tiap kali cron jalan' },
          { label: '→ Posting Monitor', desc: 'menentukan status setiap akun' },
        ]}
      />

      <form onSubmit={handleSave} className="max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {FIELD_META.map((field) => (
            <div key={field.key} className="px-6 py-5 flex items-start gap-6">
              <div className="flex-1 min-w-0">
                <label
                  htmlFor={field.key}
                  className="block text-sm font-semibold text-gray-800 mb-0.5"
                >
                  {field.label}
                </label>
                <p className="text-xs text-gray-500 leading-relaxed">{field.description}</p>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                <input
                  id={field.key}
                  type="number"
                  step={field.type === 'float' ? '0.1' : '1'}
                  min="0"
                  value={settings[field.key] as number}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-xs text-gray-400 whitespace-nowrap w-16">{field.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-success"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="btn-ghost"
          >
            Reset to Default
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved successfully
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
