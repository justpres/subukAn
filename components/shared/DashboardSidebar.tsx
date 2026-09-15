'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { 
  LayoutDashboard, 
  FileText, 
  CheckSquare, 
  DollarSign, 
  ArrowLeftRight, 
  LogOut, 
  X,
  Settings,
  Scale
} from 'lucide-react'
import { motion } from 'framer-motion'
import { createBrowserClient } from '@/lib/supabase/client'

interface SidebarProps {
  role: 'poster' | 'tester' | null
  isOpen: boolean
  onToggle: (open: boolean) => void
}

export function DashboardSidebar({ role, isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') || ''
  const supabase = createBrowserClient()
  const [isAdmin, setIsAdmin] = React.useState(false)

  React.useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          const { data } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', session.user.id)
            .single()
          if (data?.is_admin) {
            setIsAdmin(true)
          }
        }
      } catch {
        // Non-blocking check
      }
    }
    checkAdmin()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const currentRole = pathname.startsWith('/dashboard/tester') 
    ? 'tester' 
    : pathname.startsWith('/dashboard/poster') 
      ? 'poster' 
      : role || 'poster'

  const isPoster = currentRole === 'poster'
  const isTester = currentRole === 'tester'

  const links = []

  if (isPoster) {
    links.push({ name: 'Overview', href: '/dashboard/poster?tab=overview', icon: LayoutDashboard })
    links.push({ name: 'My Campaigns', href: '/dashboard/poster?tab=listings', icon: FileText })
    links.push({ name: 'Settings', href: '/dashboard/poster?tab=settings', icon: Settings })
  } else if (isTester) {
    links.push({ name: 'Available Tests', href: '/dashboard/tester?tab=available', icon: LayoutDashboard })
    links.push({ name: 'My Submissions', href: '/dashboard/tester?tab=submissions', icon: CheckSquare })
    links.push({ name: 'My Earnings', href: '/dashboard/tester?tab=earnings', icon: DollarSign })
  }

  if (isAdmin || pathname.startsWith('/dashboard/admin')) {
    links.push({ name: 'Disputes (Admin)', href: '/dashboard/admin/disputes', icon: Scale })
  }

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => onToggle(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside 
        aria-label="Sidebar Navigation"
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-[#0B0F19] text-white transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-screen lg:flex lg:flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800">
          <span className="text-xl font-extrabold tracking-tight text-white font-poppins">subukAn</span>
          <button 
            type="button"
            onClick={() => onToggle(false)}
            aria-label="Close navigation sidebar"
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2955E3] transition-colors"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Main Navigation" className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          {links.map((link) => {
            const Icon = link.icon
            const baseHref = link.href.split('?')[0]
            const isPathMatching = pathname === baseHref
            
            const linkParams = new URLSearchParams(link.href.split('?')[1] || '')
            const linkTab = linkParams.get('tab')
            
            const isActive = isPathMatching && (
              (!linkTab && (!currentTab || currentTab === 'overview' || currentTab === 'available')) ||
              (linkTab === 'overview' && (!currentTab || currentTab === 'overview')) ||
              (linkTab === 'available' && (!currentTab || currentTab === 'available')) ||
              (linkTab === currentTab)
            )
            
            return (
              <Link 
                key={link.name} 
                href={link.href}
                scroll={false}
                onClick={() => onToggle(false)}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative flex items-center space-x-3 rounded-lg px-4 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2955E3] ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeSidebarPill"
                    className="absolute inset-0 bg-[#2955E3] rounded-lg shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className={`relative z-10 h-5 w-5 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} aria-hidden="true" />
                <span className={`relative z-10 font-medium transition-colors ${isActive ? 'text-white font-semibold' : 'text-slate-400 group-hover:text-white'}`}>{link.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-slate-800 p-4 space-y-2">
          <Link 
            href="/dashboard?select=true"
            scroll={false}
            onClick={() => onToggle(false)}
            className="flex items-center space-x-3 rounded-lg px-4 py-3 text-slate-400 hover:bg-slate-800/40 hover:text-white transition-all duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2955E3]"
          >
            <ArrowLeftRight className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="font-medium">Switch Role</span>
          </Link>
          
          <button 
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 rounded-lg px-4 py-3 text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition-all duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}
