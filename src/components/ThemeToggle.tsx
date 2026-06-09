'use client'

import { useTheme } from './ThemeProvider'

export default function ThemeToggle() {
  const { theme, toggle, isAuto } = useTheme()
  const isDark = theme === 'dark'

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