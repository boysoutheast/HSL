'use client'

import { useTheme } from './ThemeProvider'

export default function ThemeToggle({ compact }: { compact?: boolean }) {
  const { theme, toggle, isAuto } = useTheme()
  const isDark = theme === 'dark'

  if (compact) {
    return (
      <button
        onClick={toggle}
        title={isAuto ? 'Auto mode. Click to override.' : `${isDark ? 'Dark' : 'Light'} mode. Click to toggle.`}
        type="button"
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors w-full"
      >
        <span className="text-sm">{isDark ? '☀️' : '🌙'}</span>
        <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
        {isAuto && <span className="ml-auto text-[10px] text-stone-400 dark:text-stone-600 bg-stone-100 dark:bg-stone-800 px-1 rounded">AUTO</span>}
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      className="btn-ghost btn-sm"
      title={isAuto ? 'Auto mode aktif. Klik untuk override manual.' : 'Manual mode aktif. Klik untuk ganti tema.'}
      type="button"
    >
      <span>{isDark ? '☀️' : '🌙'}</span>
      <span>{isDark ? 'Day' : 'Night'}</span>
      {isAuto && <span className="text-[10px] text-stone-400 dark:text-stone-500">AUTO</span>}
    </button>
  )
}
