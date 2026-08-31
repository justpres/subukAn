'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

export function DashboardBreadcrumbs() {
  const pathname = usePathname()
  
  const segments = pathname ? pathname.split('/').filter(Boolean) : []
  
  if (segments.length <= 2) {
    return null
  }
  
  const labelMap: Record<string, string> = {
    dashboard: 'Dashboard',
    poster: 'Poster',
    tester: 'Tester',
    listings: 'Listings',
    submissions: 'Submissions',
    tasks: 'Tasks',
    'five-second': 'Quick Impression',
  }

  const getLabel = (segment: string) => {
    if (labelMap[segment]) return labelMap[segment]
    // If it's a UUID or long ID, truncate it
    if (segment.length > 20) return 'Details'
    return segment
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-sm text-slate-500 font-medium select-none">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1
        const href = `/${segments.slice(0, index + 1).join('/')}`
        const label = getLabel(segment)

        const unclickableSegments = new Set(['tasks', 'listings', 'five-second'])
        const isClickable = !isLast && !unclickableSegments.has(segment)

        return (
          <React.Fragment key={href}>
            {index > 0 && <ChevronRight className="h-4 w-4 text-steel" />}
            {isClickable ? (
              <Link href={href} className="hover:text-primary-brand transition-colors">
                {label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-ink" : "text-slate"}>{label}</span>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
