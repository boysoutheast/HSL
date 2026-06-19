'use client'

export function LogoMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* A — bar miring */}
      <path d="M30 6 L18 58 L9 58 L21 6 Z" />
      {/* titik */}
      <circle cx="27.5" cy="51" r="5" />
      {/* B — stem + 2 lobe */}
      <path d="M35 6 h9 a13 13 0 0 1 0 26 a13 13 0 0 1 0 26 h-9 Z" />
    </svg>
  )
}

export function Logo({ wordmark = true, className = '' }: { wordmark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      {wordmark && <span className="font-bold tracking-tight">AI Buddy</span>}
    </span>
  )
}
