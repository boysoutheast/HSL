import type { Metadata } from 'next'
import './globals.css'
import 'driver.js/dist/driver.css'
import LayoutShell from '@/components/LayoutShell'
import { ThemeProvider } from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: 'AI Buddy',
  description: 'Dashboard otomasi Meta Ads & generate konten — AI Buddy',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-stone-100 text-stone-900">
        <ThemeProvider>
          <LayoutShell>{children}</LayoutShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
