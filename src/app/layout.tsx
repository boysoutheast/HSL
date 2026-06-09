import type { Metadata } from 'next'
import './globals.css'
import LayoutShell from '@/components/LayoutShell'

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
    <html lang="en">
      <body className="bg-stone-100">
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  )
}
