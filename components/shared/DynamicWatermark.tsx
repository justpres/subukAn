'use client'

import React from 'react'

interface DynamicWatermarkProps {
  testerId?: string | null
  customText?: string
  className?: string
}

export function DynamicWatermark({
  testerId,
  customText,
  className = '',
}: DynamicWatermarkProps) {
  const [mounted, setMounted] = React.useState(false)
  const [timestamp, setTimestamp] = React.useState('')

  React.useEffect(() => {
    setMounted(true)
    const now = new Date()
    setTimestamp(
      now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) +
        ' ' +
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
    )
  }, [])

  if (!mounted) return null

  const pseudonymousId = testerId ? testerId.slice(0, 8) : 'ANON'
  const watermarkText =
    customText || `SubukAn Confidential • Tester #${pseudonymousId} • ${timestamp}`

  // Render a repeating subtle grid of rotated watermarks across the parent container
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none absolute inset-0 z-20 overflow-hidden opacity-[0.06] dark:opacity-[0.08] ${className}`}
    >
      <div className="absolute -inset-16 grid grid-cols-2 sm:grid-cols-3 gap-16 md:gap-24 items-center justify-center -rotate-12">
        {Array.from({ length: 12 }).map((_, idx) => (
          <div
            key={idx}
            className="flex items-center justify-center text-xs sm:text-sm font-mono font-semibold tracking-wider text-slate-900 whitespace-nowrap"
          >
            {watermarkText}
          </div>
        ))}
      </div>
    </div>
  )
}
