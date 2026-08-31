'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { DashboardSidebar } from '@/components/shared/DashboardSidebar'
import { DashboardBreadcrumbs } from '@/components/shared/DashboardBreadcrumbs'
import { NotificationCenter } from '@/components/shared/NotificationCenter'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [role, setRole] = useState<'poster' | 'tester' | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const client = createBrowserClient()
        const { data: { session } } = await client.auth.getSession()
        if (session?.user?.id) {
          const { data } = await client
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single()

          if (data && (data.role === 'poster' || data.role === 'tester')) {
            setRole(data.role as 'poster' | 'tester')
          }
        }
      } catch (error: unknown) {
        console.error('Error fetching profile:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [])

  const headerTitle = pathname.includes('/poster')
    ? 'Poster Workspace'
    : pathname.includes('/tester')
    ? 'Tester Hub'
    : role === 'poster'
    ? 'Poster Workspace'
    : role === 'tester'
    ? 'Tester Hub'
    : 'Dashboard'

  const isGatePage = pathname === '/dashboard'

  if (isGatePage) {
    return <div className="min-h-screen bg-canvas">{children}</div>
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="animate-pulse text-slate">Loading dashboard…</div>
      </div>
    )
  }
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas relative">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-200/15 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-200/10 blur-[120px] pointer-events-none z-0" />
      
      <DashboardSidebar 
        role={role} 
        isOpen={isSidebarOpen} 
        onToggle={setIsSidebarOpen} 
      />
      
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden z-10">
        <ErrorBoundary fallback={
          <header className="flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-slate-200/80 z-30 relative shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-slate-800 font-poppins">subukAn</span>
            </div>
            <div className="text-xs text-slate-400 font-mono">Header suspended</div>
          </header>
        }>
          <header className="flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-slate-200/80 z-30 relative shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900 transition-colors"
              >
                <Menu className="h-6 w-6" />
              </button>
              <DashboardBreadcrumbs />
            </div>

            <div className="flex items-center gap-3">
              <NotificationCenter />
            </div>
          </header>
        </ErrorBoundary>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-h-0">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
