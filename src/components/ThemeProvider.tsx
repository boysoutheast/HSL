'use client'

import { createContext, useContext, useEffect } from 'react'

// Dark mode dimatikan — banyak halaman light-only, auto-dark bikin text/button tabrakan.
// Kalau mau dark mode lagi: retrofit dark: variant ke semua page dulu.

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
  isAuto: boolean
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggle: () => {},
  isAuto: false,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Bersihkan sisa dark mode dari localStorage / html class
    document.documentElement.classList.remove('dark')
    localStorage.removeItem('hsl-theme-mode')
    localStorage.removeItem('hsl-theme')
  }, [])

  return (
    <ThemeContext.Provider value={{ theme: 'light', toggle: () => {}, isAuto: false }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
