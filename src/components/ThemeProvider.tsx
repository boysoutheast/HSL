'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
  isAuto: boolean
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggle: () => {},
  isAuto: true,
})

function getAutoTheme(): Theme {
  const hour = new Date().getHours()
  // Dark: 18:00–05:59, Light: 06:00–17:59
  return hour >= 6 && hour < 18 ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [isAuto, setIsAuto] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // First launch: determine auto vs manual
    const saved = localStorage.getItem('hsl-theme-mode') // 'auto' | 'manual'
    const savedTheme = localStorage.getItem('hsl-theme') as Theme | null

    if (saved === 'manual' && savedTheme) {
      setTheme(savedTheme)
      setIsAuto(false)
    } else {
      // Auto mode: use time-based theme
      setTheme(getAutoTheme())
      setIsAuto(true)
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(theme)
  }, [theme, mounted])

  const toggle = () => {
    if (isAuto) {
      // First manual toggle — override auto
      const next = theme === 'light' ? 'dark' : 'light'
      setTheme(next)
      setIsAuto(false)
      localStorage.setItem('hsl-theme-mode', 'manual')
      localStorage.setItem('hsl-theme', next)
    } else {
      // Already manual — just flip
      const next = theme === 'light' ? 'dark' : 'light'
      setTheme(next)
      localStorage.setItem('hsl-theme', next)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle, isAuto }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}