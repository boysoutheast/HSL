import type { Metadata } from 'next'
import './globals.css'
import LayoutShell from '@/components/LayoutShell'
import { ThemeProvider } from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: 'Hermes Support Library',
  description: 'Internal admin dashboard for managing Instagram accounts and Hermes AI agents',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* ── Apply theme before CSS loads — prevent white flash on dark ── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              const saved = localStorage.getItem('hsl-theme-mode');
              const theme = localStorage.getItem('hsl-theme');
              if (saved === 'manual' && theme === 'dark') {
                document.documentElement.classList.add('dark');
              } else if (saved !== 'manual') {
                const hour = new Date().getHours();
                if (hour >= 18 || hour < 6) {
                  document.documentElement.classList.add('dark');
                }
              }
            `,
          }}
        />
      </head>
      <body className="bg-stone-100 text-stone-900 dark:bg-stone-950 dark:text-stone-50 transition-colors">
        <ThemeProvider>
          <LayoutShell>{children}</LayoutShell>
        </ThemeProvider>
      </body>
    </html>
  )
}