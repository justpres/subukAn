'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { 
  Bell, 
  X, 
  Check, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  ShieldAlert, 
  ExternalLink 
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Notification } from '@/types'

const DEFAULT_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    user_id: 'current-user',
    title: 'Payout Approved',
    message: 'Your GCash payout request of ₱400.00 has been processed and credited.',
    type: 'payout_approved',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
    link_url: '/dashboard/tester?tab=earnings'
  },
  {
    id: 'n2',
    user_id: 'current-user',
    title: 'Submission Approved',
    message: 'Poster accepted your submission for "E-Commerce App GCash Checkout Test". ₱200.00 credited!',
    type: 'submission_update',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
    link_url: '/dashboard/tester?tab=submissions'
  },
  {
    id: 'n3',
    user_id: 'current-user',
    title: 'New Listing Alert',
    message: 'A new target-matched job "Sari-Sari Store Inventory App Initial Run" is now open.',
    type: 'new_listing',
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(), // 6 hours ago
    link_url: '/dashboard/tester?tab=available'
  },
  {
    id: 'n4',
    user_id: 'current-user',
    title: 'Dispute Update',
    message: 'Support team initiated re-review for your disputed submission.',
    type: 'dispute_update',
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 1440).toISOString(), // 1 day ago
    link_url: '/dashboard/tester?tab=submissions'
  }
]

const formatTime = (dateStr: string) => {
  if (!dateStr) return 'Recently'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 'Recently'
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    return 'Recently'
  }
}

export function NotificationCenter() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(DEFAULT_NOTIFICATIONS)
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()

  // Handle escape key to dismiss popover
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const formatLink = (url: string) => {
    if (!url) return ''
    return url
      .replace('#submissions', '?tab=submissions')
      .replace('#earnings', '?tab=earnings')
      .replace('#available', '?tab=available')
      .replace('#listings', '?tab=listings')
      .replace('#overview', '?tab=overview')
      .replace('#settings', '?tab=settings')
  }

  const getFooterHref = () => {
    if (pathname.includes('/poster')) {
      return '/dashboard/poster?tab=overview'
    }
    return '/dashboard/tester?tab=submissions'
  }

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setNotifications(DEFAULT_NOTIFICATIONS)
        return
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!error && Array.isArray(data) && data.length > 0) {
        setNotifications(data as Notification[])
      } else {
        setNotifications(DEFAULT_NOTIFICATIONS)
      }
    } catch (e) {
      console.warn('Error fetching notifications:', e)
      setNotifications(DEFAULT_NOTIFICATIONS)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const unreadCount = notifications.filter(n => !n.is_read).length

  const handleMarkAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
    } catch (e) {
      console.warn('Failed to sync notification mark read:', e)
    }
  }

  const handleMarkAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
      }
    } catch (e) {
      console.warn('Failed to sync mark all read:', e)
    }
  }

  const handleClearOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setNotifications(prev => prev.filter(n => n.id !== id))
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
    } catch (err) {
      console.warn('Failed to delete notification:', err)
    }
  }

  const isToday = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      const now = new Date()
      return d.getDate() === now.getDate() &&
             d.getMonth() === now.getMonth() &&
             d.getFullYear() === now.getFullYear()
    } catch (e) {
      return false
    }
  }

  const renderIcon = (type: Notification['type']) => {
    switch (type) {
      case 'payout_approved':
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4" />
          </div>
        )
      case 'submission_update':
        return (
          <div className="w-8 h-8 rounded-full bg-blue-50 text-[#2955E3] border border-blue-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        )
      case 'new_listing':
        return (
          <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4" />
          </div>
        )
      case 'dispute_update':
        return (
          <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
        )
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
        )
    }
  }

  const renderNotificationItem = (notif: Notification) => {
    return (
      <div
        key={notif.id}
        onClick={() => handleMarkAsRead(notif.id)}
        className={`p-3.5 transition-all duration-150 cursor-pointer flex items-start gap-3 relative group ${
          notif.is_read ? 'bg-white hover:bg-slate-50/80' : 'bg-[#2955E3]/5 hover:bg-[#2955E3]/10'
        }`}
      >
        {renderIcon(notif.type)}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <h4 className="text-xs font-bold text-slate-900 truncate">
              {notif.title}
            </h4>
            <span className="text-[10px] text-slate-400 shrink-0 ml-2 font-mono">
              {formatTime(notif.created_at)}
            </span>
          </div>
          
          <p className="text-xs text-slate-700 leading-relaxed break-words font-normal">
            {notif.message}
          </p>

          {notif.link_url && (
            <a
              href={formatLink(notif.link_url)}
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2955E3] hover:text-[#1D4ED8] mt-1.5 transition-colors"
            >
              View Details <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="flex flex-col items-center justify-between h-full py-0.5 self-stretch shrink-0">
          {!notif.is_read ? (
            <span className="w-2 h-2 rounded-full bg-[#2955E3] shrink-0 mt-1" />
          ) : (
            <div className="w-2 h-2" />
          )}

          <button
            type="button"
            onClick={(e) => handleClearOne(notif.id, e)}
            title="Dismiss"
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-opacity rounded-md hover:bg-slate-100 mt-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  const todayNotifs = notifications.filter(n => isToday(n.created_at))
  const earlierNotifs = notifications.filter(n => !isToday(n.created_at))

  return (
    <div className="relative inline-block">
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open notifications"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="relative p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2955E3] focus:ring-0 animate-bell-wiggle"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover Flyout Overlay & Container */}
      {isOpen && (
        <>
          {/* Backdrop click-away overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[0.5px] transition-opacity" 
            onClick={() => setIsOpen(false)} 
          />

          {/* Popover Container */}
          <div className="absolute right-0 mt-2 z-50 w-[calc(100vw-2rem)] sm:w-96 max-h-[480px] bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col overflow-hidden animate-fadeIn">
            {/* Header: Clean layout with title, new badge, mark all read, and single X close */}
            <div className="p-3.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700">
                    {unreadCount} new
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" /> Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close notifications"
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/50 transition-colors ml-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto divide-y divide-slate-100 flex-1 overscroll-contain">
              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400 font-mono">
                  Loading updates...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Bell className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No notifications yet</p>
                  <p className="text-[11px] text-slate-500 leading-normal max-w-xs mx-auto">
                    Updates regarding payouts, submissions, and alerts will appear here.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {todayNotifs.length > 0 && (
                    <div className="flex flex-col">
                      <div className="bg-slate-50/70 px-4 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 select-none">
                        TODAY
                      </div>
                      <div className="divide-y divide-slate-100">
                        {todayNotifs.map(renderNotificationItem)}
                      </div>
                    </div>
                  )}
                  {earlierNotifs.length > 0 && (
                    <div className="flex flex-col">
                      <div className="bg-slate-50/70 px-4 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider border-y border-slate-100 select-none">
                        EARLIER
                      </div>
                      <div className="divide-y divide-slate-100">
                        {earlierNotifs.map(renderNotificationItem)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50/90 border-t border-slate-200 text-center shrink-0">
              <a
                href={getFooterHref()}
                onClick={() => setIsOpen(false)}
                className="text-xs font-semibold text-[#2955E3] hover:text-[#1D4ED8] transition-colors inline-flex items-center gap-1"
              >
                See all notifications →
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
