'use client'

import React, { useState, useEffect } from 'react'

interface TimerDisplayProps {
  initialSeconds: number;
  onExpire?: () => void;
}

export function TimerDisplay({ initialSeconds, onExpire }: TimerDisplayProps) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds)

  useEffect(() => {
    if (timeLeft <= 0) {
      onExpire?.()
      return
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, onExpire])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  // Determine announcement text for major time milestones
  const milestoneAnnouncement = 
    timeLeft === 300 ? '5 minutes remaining' :
    timeLeft === 120 ? '2 minutes remaining' :
    timeLeft === 60 ? '1 minute remaining' :
    timeLeft === 30 ? '30 seconds remaining' :
    timeLeft === 10 ? '10 seconds remaining' :
    null

  return (
    <div 
      role="timer"
      aria-label={`Time Remaining: ${minutes} minutes and ${seconds} seconds`}
      className="sticky top-0 bg-amber-50 border-b border-amber-200 p-3 text-center font-mono font-bold text-amber-900 z-50 shadow-xs"
    >
      <span>Time Remaining: {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}</span>
      {milestoneAnnouncement && (
        <span role="status" aria-live="polite" className="sr-only">
          {milestoneAnnouncement}
        </span>
      )}
    </div>
  )
}
