'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { modalBackdropVariants, modalContentVariants } from '@/lib/utils/motion'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { 
  Wallet, 
  CheckCircle, 
  Video, 
  ChevronRight, 
  AlertCircle, 
  Clock, 
  ShieldAlert, 
  FileText, 
  Smartphone, 
  User, 
  Zap, 
  Target, 
  Globe,
  Scale,
  Check,
  ArrowRight,
  Phone,
  Copy,
  Shield
} from 'lucide-react'
import { ProfileModal } from '@/components/shared/ProfileModal'
import { DisputeModal } from '@/components/shared/DisputeModal'
import { createBrowserClient } from '@/lib/supabase/client'
import { sanitizeDatabaseError } from '@/lib/utils/error'
import { JobListing, getButtonConfig } from '@/lib/utils/claim-button'
import { formatRejectionReason, formatDisputeReason } from '@/lib/utils/workspace-status'
import { filterListingsByDemographics, isProfileDemographicsIncomplete, isListingTargeted, getUnmetDemographicRequirements } from '@/lib/utils/demographics'
import { UserProfile } from '@/types'
import dynamic from 'next/dynamic'
import { LineChart } from '@tremor/react'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

const Chrono = dynamic(() => import('react-chrono').then(mod => mod.Chrono), { ssr: false })

export interface SubmissionRecord {
  id: string
  listing_id: string
  listing_title: string
  rate_per_tester: number
  status: 'in_progress' | 'pending_review' | 'approved' | 'rejected' | 'disputed' | 'expired'
  rejection_reason?: string | null
  rejection_explanation?: string | null
  dispute_reason?: string | null
  dispute_explanation?: string | null
  submitted_at?: string | null
  created_at: string
}

export interface PayoutRecord {
  id: string
  reference_id: string
  amount: number
  gcash_number: string
  status: 'completed' | 'processing' | 'pending'
  created_at: string
}

const maskGcashNumber = (num: string) => {
  if (!num) return 'Not configured'
  if (num.includes('***')) return num
  const cleaned = num.replace(/[-\s]/g, '')
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 4)}-***-${cleaned.slice(7)}`
  }
  return num
}

const getLast4OfGcash = (num: string) => {
  if (!num) return '----'
  const cleaned = num.replace(/[-\s]/g, '')
  if (cleaned.length >= 4) {
    return cleaned.slice(-4)
  }
  return '----'
}

function TesterDashboardContent() {
  const supabase = createBrowserClient()

  // Navigation tab state: 'available' | 'submissions' | 'earnings'
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = (searchParams.get('tab') as 'available' | 'submissions' | 'earnings') || 'available'

  // Profile and earnings states
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [withdrawableBalance, setWithdrawableBalance] = useState(0)
  const [gcashNumber, setGcashNumber] = useState('')
  const [profile, setProfile] = useState<Partial<UserProfile> | null>(null)
  const [copiedText, setCopiedText] = useState<'card' | 'gcash' | null>(null)

  const handleCopy = (text: string, type: 'card' | 'gcash') => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedText(type)
    setTimeout(() => setCopiedText(null), 1500)
  }
  const [rawListings, setRawListings] = useState<JobListing[]>([])

  const { matchedListings, unmatchedListings, unmatchedCount } = useMemo(() => {
    return filterListingsByDemographics(rawListings, profile)
  }, [rawListings, profile])

  // Display all open/filling listings in feed: matched listings first, followed by targeted/unmatched listings
  const listings = useMemo(() => {
    return [...matchedListings, ...unmatchedListings]
  }, [matchedListings, unmatchedListings])
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([])
  const [payouts, setPayouts] = useState<PayoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const isMountedRef = useRef(true)
  const isFetchingRef = useRef(false)
  const fetchSeqRef = useRef(0)

  useEffect(() => {
    isMountedRef.current = true
    setMounted(true)
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const totalEarnedValue = withdrawableBalance + payouts
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0)

  // Payout modal states
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [payoutError, setPayoutError] = useState<string | null>(null)
  const [payoutSuccess, setPayoutSuccess] = useState(false)
  const [payoutGcashNumber, setPayoutGcashNumber] = useState('')

  // Settings & Dispute modals state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [disputeModalState, setDisputeModalState] = useState<{
    isOpen: boolean
    submissionId: string
    listingTitle: string
  }>({
    isOpen: false,
    submissionId: '',
    listingTitle: ''
  })

  const switchTab = (tab: 'available' | 'submissions' | 'earnings') => {
    router.push(`/dashboard/tester?tab=${tab}`, { scroll: false })
  }

  const fetchProfileAndListings = useCallback(async (silent = false) => {
    if (isFetchingRef.current && silent) {
      return
    }
    isFetchingRef.current = true
    const currentSeq = ++fetchSeqRef.current

    if (!silent) {
      setLoading(true)
      setLoadingError(null)
    }

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        if (!isMountedRef.current || currentSeq !== fetchSeqRef.current) return
        if (!silent) {
          setLoadingError('Authentication required.')
          setLoading(false)
        }
        return
      }

      // 1. Fetch profile demographics
      let profileData: Partial<UserProfile> | null = null
      let profileError = null

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        profileData = data
        profileError = error
      } catch (err: unknown) {
        console.warn('Profile fetch threw exception:', err)
      }

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          try {
            const newProfile = {
              id: user.id,
              role: 'tester',
              updated_at: new Date().toISOString()
            }
            const { error: insertError, data: insertedData } = await supabase
              .from('profiles')
              .insert(newProfile)
              .select()
              .single()

            if (!insertError && insertedData) {
              profileData = insertedData
              profileError = null
            } else {
              profileData = {
                id: user.id,
                role: 'tester',
                age_group: '',
                gender: '',
                employment_status: '',
                tech_literacy: '',
                accessibility_tags: [],
                location: 'Metro Manila',
                device_types: ['Android Mobile', 'Windows PC'],
                notification_settings: {
                  email_payouts: true,
                  email_submissions: true,
                  email_listings: true,
                  email_disputes: true
                }
              }
              profileError = null
            }
          } catch {
            profileData = {
              id: user.id,
              role: 'tester',
              age_group: '',
              gender: '',
              employment_status: '',
              tech_literacy: '',
              accessibility_tags: [],
              location: 'Metro Manila',
              device_types: ['Android Mobile', 'Windows PC'],
              notification_settings: {
                email_payouts: true,
                email_submissions: true,
                email_listings: true,
                email_disputes: true
              }
            }
            profileError = null
          }
        } else if (profileError.message?.includes('profiles') || profileError.message?.includes('schema cache')) {
          profileData = {
            id: user.id,
            role: 'tester',
            age_group: '',
            gender: '',
            employment_status: '',
            tech_literacy: '',
            accessibility_tags: [],
            location: 'Metro Manila',
            device_types: ['Android Mobile', 'Windows PC'],
            notification_settings: {
              email_payouts: true,
              email_submissions: true,
              email_listings: true,
              email_disputes: true
            }
          }
          profileError = null
        }
      }

      if (profileError || !profileData) {
        if (!isMountedRef.current || currentSeq !== fetchSeqRef.current) return
        if (!silent) {
          setLoadingError(sanitizeDatabaseError(profileError, 'Failed to retrieve user profile.'))
          setLoading(false)
        }
        return
      }

      if (!isMountedRef.current || currentSeq !== fetchSeqRef.current) return
      setProfile(prev => {
        const merged: Partial<UserProfile> = {
          ...prev,
          ...profileData,
        }
        if (profileData.location !== undefined) {
          merged.location = profileData.location
        }
        if (profileData.device_types !== undefined) {
          merged.device_types = profileData.device_types
        }
        if (profileData.notification_settings !== undefined) {
          merged.notification_settings = profileData.notification_settings
        }
        return merged
      })
      if (profileData.phone) {
        setGcashNumber(profileData.phone)
      }

      // Fetch tester earnings & payouts
      try {
        const { data: payoutsData } = await supabase
          .from('payouts')
          .select('*')
          .eq('tester_id', user.id)
          .order('created_at', { ascending: false })

        interface PayoutRow {
          id: string
          reference_id?: string | null
          amount: number
          gcash_number?: string | null
          status?: 'completed' | 'processing' | 'pending'
          created_at: string
        }

        if (payoutsData && payoutsData.length > 0) {
          const rows = payoutsData as unknown as PayoutRow[]
          if (isMountedRef.current && currentSeq === fetchSeqRef.current) {
            setPayouts(rows.map((p) => ({
              id: p.id,
              reference_id: p.reference_id || `PAY-GCASH-${p.id.slice(0, 4)}`,
              amount: p.amount,
              gcash_number: p.gcash_number || 'Not configured',
              status: p.status || 'completed',
              created_at: p.created_at
            })))
            const totalPaid = rows
              .filter((p) => p.status === 'completed')
              .reduce((sum: number, p) => sum + p.amount, 0)
            setTotalEarnings(totalPaid)
            setWithdrawableBalance(Math.max(0, totalPaid))
          }
        } else if (isMountedRef.current && currentSeq === fetchSeqRef.current) {
          setPayouts([])
          setTotalEarnings(0)
          setWithdrawableBalance(0)
        }
      } catch (err) {
        console.warn('Payouts query fallback:', err)
        if (isMountedRef.current && currentSeq === fetchSeqRef.current) {
          setPayouts([])
        }
      }

      // 2. Fetch submissions for user
      try {
        const { data: userSubsData } = await supabase
          .from('submissions')
          .select(`
            id,
            listing_id,
            status,
            rejection_reason,
            rejection_explanation,
            dispute_reason,
            dispute_explanation,
            submitted_at,
            created_at,
            listings (
              title,
              rate_per_tester
            )
          `)
          .eq('tester_id', user.id)
          .order('created_at', { ascending: false })

        interface UserSubmissionRow {
          id: string
          listing_id: string
          status: SubmissionRecord['status']
          rejection_reason?: string | null
          rejection_explanation?: string | null
          dispute_reason?: string | null
          dispute_explanation?: string | null
          submitted_at?: string | null
          created_at: string
          listings?: {
            title?: string
            rate_per_tester?: number
          } | null
        }

        if (userSubsData && userSubsData.length > 0) {
          const rows = userSubsData as unknown as UserSubmissionRow[]
          const mappedSubs: SubmissionRecord[] = rows.map((s) => ({
            id: s.id,
            listing_id: s.listing_id,
            listing_title: s.listings?.title || 'Testing Listing Task',
            rate_per_tester: s.listings?.rate_per_tester || 150,
            status: s.status,
            rejection_reason: s.rejection_reason || undefined,
            rejection_explanation: s.rejection_explanation || undefined,
            dispute_reason: s.dispute_reason || undefined,
            dispute_explanation: s.dispute_explanation || undefined,
            submitted_at: s.submitted_at || undefined,
            created_at: s.created_at
          }))
          if (isMountedRef.current && currentSeq === fetchSeqRef.current) {
            setSubmissions(mappedSubs)
          }
        } else if (isMountedRef.current && currentSeq === fetchSeqRef.current) {
          setSubmissions([])
        }
      } catch (err) {
        console.warn('User submissions fetch fallback:', err)
        if (isMountedRef.current && currentSeq === fetchSeqRef.current) {
          setSubmissions([])
        }
      }

      // 3. Fetch open and filling listings
      const { data: listingsData, error: listingsError } = await supabase
        .from('listings')
        .select(`
          *,
          tasks (
            id,
            question_text,
            requires_recording,
            requires_image
          ),
          submissions (
            id,
            status
          )
        `)
        .in('status', ['open', 'filling'])
        .order('created_at', { ascending: false })

      if (listingsError) {
        if (!silent && isMountedRef.current && currentSeq === fetchSeqRef.current) {
          setLoadingError(sanitizeDatabaseError(listingsError, 'Failed to load listings.'))
        } else {
          console.warn('Silent listings fetch error:', listingsError)
        }
      } else {
        let userSubmissions: { id: string; listing_id: string; status: string }[] = []
        try {
          const { data: userSubsData } = await supabase
            .from('submissions')
            .select('id, listing_id, status')
            .eq('tester_id', user.id)

          if (userSubsData) {
            userSubmissions = userSubsData
          }
        } catch (err) {
          console.warn('Could not fetch user submissions:', err)
        }

        interface ListingRow {
          id: string
          title: string
          description: string
          rate_per_tester: number
          slots_count: number
          is_quick_impression?: boolean
          target_age_group?: string | null
          target_gender?: string | null
          target_employment_status?: string | null
          target_tech_literacy?: string | null
          target_accessibility_tags?: string[] | null
          site_url?: string | null
          tasks?: Array<{
            id: string
            question_text?: string | null
            requires_recording?: boolean | null
            requires_image?: boolean | null
          }>
          submissions?: Array<{
            id: string
            status: string
          }>
        }

        const mapped: JobListing[] = ((listingsData as unknown as ListingRow[]) || []).map((listing) => {
          const firstTask = listing.tasks?.[0]
          const userSub = userSubmissions.find((s) => s.listing_id === listing.id)
          const userSubmissionStatus = (userSub ? userSub.status : null) as JobListing['user_submission_status']

          return {
            id: listing.id,
            title: listing.title,
            description: listing.description,
            rate_per_tester: listing.rate_per_tester,
            slots_count: listing.slots_count,
            slots_filled: listing.submissions 
              ? listing.submissions.filter((s) => s.status !== 'expired' && s.status !== 'rejected').length 
              : 0,
            requires_recording: listing.tasks?.some((t) => Boolean(t.requires_recording)) || false,
            requires_image: listing.tasks?.some((t) => Boolean(t.requires_image)) || false,
            question_text: firstTask?.question_text || 'Provide feedback on this design.',
            is_quick_impression: Boolean(listing.is_quick_impression),
            target_age_group: listing.target_age_group,
            target_gender: listing.target_gender,
            target_employment_status: listing.target_employment_status,
            target_tech_literacy: listing.target_tech_literacy,
            target_accessibility_tags: listing.target_accessibility_tags,
            user_submission_status: userSubmissionStatus,
            site_url: listing.site_url,
          }
        })

        if (isMountedRef.current && currentSeq === fetchSeqRef.current) {
          setRawListings(mapped)
        }
      }
    } catch (err) {
      if (!silent && isMountedRef.current && currentSeq === fetchSeqRef.current) {
        setLoadingError(sanitizeDatabaseError(err, 'An error occurred.'))
      } else {
        console.warn('Background sync error:', err)
      }
    } finally {
      isFetchingRef.current = false
      if (!silent && isMountedRef.current && currentSeq === fetchSeqRef.current) {
        setLoading(false)
        setIsInitialLoad(false)
      }
    }
  }, [supabase])

  useEffect(() => {
    fetchProfileAndListings(false)

    // 1. Supabase Realtime channel subscription with unique channel identifier
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      const channelId = `tester-listings-${Math.random().toString(36).substring(2, 9)}`
      channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'listings' },
          () => {
            fetchProfileAndListings(true)
          }
        )
        .subscribe()
    } catch (err) {
      console.warn('Supabase Realtime subscription error:', err)
    }

    // 2. Periodic background heartbeat polling (every 15 seconds) when tab is active
    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchProfileAndListings(true)
      }
    }, 15000)

    // 3. Tab focus and visibilitychange event listeners for instant re-fetch upon tab return
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchProfileAndListings(true)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', handleVisibilityOrFocus)
      window.addEventListener('focus', handleVisibilityOrFocus)
    }

    // Complete cleanup on component unmount
    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel)
        } catch (err) {
          console.warn('Error removing Realtime channel:', err)
        }
      }
      clearInterval(pollInterval)
      if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleVisibilityOrFocus)
        window.removeEventListener('focus', handleVisibilityOrFocus)
      }
    }
  }, [supabase, fetchProfileAndListings])

  const handleUpdateProfile = async (updatedData: Partial<UserProfile>) => {
    const targetUserId = profile?.id || (await supabase.auth.getUser()).data.user?.id
    if (!targetUserId) {
      throw new Error('Authentication required to save profile.')
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updatedData)
        .eq('id', targetUserId)

      if (error) {
        // Check if error is specifically due to extended columns missing in older DB schema
        const isExtendedColumnError =
          error.message?.includes('device_types') ||
          error.message?.includes('notification_settings') ||
          error.message?.includes('location') ||
          error.code === 'PGRST204' ||
          error.code === '42703' ||
          (Boolean(error.message?.includes('schema cache')) && (
            Boolean(error.message?.includes('column')) ||
            Boolean(error.message?.includes('Could not find'))
          ))

        if (isExtendedColumnError) {
          console.warn('Extended profile columns missing in DB schema cache. Falling back to core profile payload.', error)
          const {
            device_types: _dt,
            location: _loc,
            notification_settings: _ns,
            ...legacyPayload
          } = updatedData

          const { error: fallbackError } = await supabase
            .from('profiles')
            .update(legacyPayload)
            .eq('id', targetUserId)

          if (fallbackError) {
            const sanitized = sanitizeDatabaseError(fallbackError, 'Failed to update profile settings.')
            throw new Error(sanitized)
          }
        } else {
          const sanitized = sanitizeDatabaseError(error, 'Failed to update profile settings.')
          throw new Error(sanitized)
        }
      }

      setProfile(prev => ({ ...prev, ...updatedData }))
      await fetchProfileAndListings()
    } catch (err: unknown) {
      console.error('Profile update failed:', err)
      throw err
    }
  }

  const handleOpenDispute = (subId: string, title: string) => {
    setDisputeModalState({
      isOpen: true,
      submissionId: subId,
      listingTitle: title
    })
  }

  const handleDisputeSubmit = async (reason: string, explanation: string) => {
    const subId = disputeModalState.submissionId
    if (!subId) return

    try {
      const { error } = await supabase
        .from('submissions')
        .update({
          status: 'disputed',
          dispute_reason: reason,
          dispute_explanation: explanation
        })
        .eq('id', subId)

      if (error && !error.message?.includes('schema cache')) {
        console.warn('Dispute DB update error:', error)
      }

      // Update local submissions list state
      setSubmissions(prev => prev.map(s => {
        if (s.id === subId) {
          return {
            ...s,
            status: 'disputed',
            dispute_reason: reason,
            dispute_explanation: explanation
          }
        }
        return s
      }))
    } catch (err) {
      console.error('Failed to submit dispute:', err)
      throw err
    }
  }

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault()
    setPayoutError(null)
    setPayoutSuccess(false)
    
    const gcashRegex = /^09\d{9}$/
    if (!gcashRegex.test(payoutGcashNumber)) {
      setPayoutError('Invalid GCash number. Must be 11 digits starting with 09 (e.g. 09171234567).')
      return
    }

    setPayoutLoading(true)
    try {
      if (profile?.id) {
        await supabase
          .from('profiles')
          .update({ phone: payoutGcashNumber })
          .eq('id', profile.id)
      }

      setPayoutSuccess(true)
      setGcashNumber(payoutGcashNumber)
      setProfile(prev => prev ? { ...prev, phone: payoutGcashNumber } : prev)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setPayoutError(err.message)
      } else {
        setPayoutError('An unexpected error occurred.')
      }
    } finally {
      setPayoutLoading(false)
    }
  }

  // Active Task Resolution
  const activeSubmission = submissions.find(s => s.status === 'in_progress')
  const activeJob = rawListings.find(l => l.user_submission_status === 'in_progress' || (activeSubmission && l.id === activeSubmission.listing_id))
  const hasActiveTask = Boolean(activeSubmission || activeJob)
  const activeTaskTitle = activeJob?.title || activeSubmission?.listing_title || 'Active Test Session'
  const activeTaskHref = activeJob?.is_quick_impression 
    ? `/dashboard/tester/tasks/five-second/${activeJob.id}` 
    : `/dashboard/tester/tasks/${activeJob?.id || activeSubmission?.listing_id || ''}`

  if (loading && isInitialLoad) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#2955E3] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold text-slate-500 font-mono">Loading Tester Workspace...</span>
        </div>
      </div>
    )
  }

  if (loadingError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200/80 rounded-xl p-8 max-w-md text-center shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Workspace Unavailable</h2>
          <p className="text-xs text-slate-500">{loadingError}</p>
          <button 
            onClick={() => fetchProfileAndListings()} 
            className="px-4 py-2 bg-[#2955E3] hover:bg-[#1D4ED8] text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* 1. Header & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/70">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-poppins">
            Tester Workspace
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 font-medium">
            Explore available testing opportunities, track submissions, and manage payouts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-2"
          >
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span>Profile &amp; Demographics</span>
          </button>
        </div>
      </div>

      {/* 2. Top 3-Card Financial & Status Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Available Balance & Destination GCash */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all hover-lift hover:shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Withdrawable Earnings
              </span>
            </div>
            <div className="mt-2.5">
              <span className="font-mono tabular-nums text-3xl font-extrabold text-slate-900 tracking-tight">
                ₱{withdrawableBalance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[11px] text-slate-400 block font-medium">Destination GCash</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-mono font-bold text-slate-800">
                  {maskGcashNumber(gcashNumber || profile?.phone || '')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(true)}
                  className="text-[11px] text-[#2955E3] hover:text-[#1D4ED8] font-semibold hover:underline"
                >
                  Edit
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPayoutModal(true)}
              disabled={withdrawableBalance <= 0}
              className="bg-[#2955E3] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:hover:bg-[#2955E3] disabled:cursor-not-allowed text-white font-bold px-3.5 py-1.5 rounded-lg text-xs shadow-xs transition-all shrink-0 active:scale-95"
            >
              Cash Out
            </button>
          </div>
        </div>

        {/* Card 2: Active Slot & Task In Progress */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all hover-lift hover:shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Current Test Activity
              </span>
            </div>
            {hasActiveTask ? (
              <div className="mt-2.5 space-y-1">
                <h4 className="font-bold text-sm text-slate-900 truncate">
                  {activeTaskTitle}
                </h4>
                <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Test reserved • Complete before time expires</span>
                </div>
              </div>
            ) : (
              <div className="mt-2.5 space-y-0.5">
                <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <span>Ready for New Tests</span>
                </div>
                <p className="text-xs text-slate-500">
                  Claim an open opportunity below to start earning.
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            {hasActiveTask ? (
              <Link
                href={activeTaskHref}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                <span>Resume Test →</span>
              </Link>
            ) : (
              <button
                onClick={() => switchTab('available')}
                className="text-xs font-bold text-[#2955E3] hover:text-[#1D4ED8] flex items-center gap-1 transition-colors"
              >
                <span>Browse Open Tests</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Card 3: All-Time Earnings & Completed Tests */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all hover-lift hover:shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Earnings
              </span>
            </div>
            <div className="mt-2.5">
              <span className="font-mono tabular-nums text-3xl font-extrabold text-slate-900 tracking-tight">
                ₱{totalEarnedValue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500 font-medium block truncate">
              {payouts.filter(p => p.status === 'completed').length} Payouts Received • {submissions.filter(s => s.status === 'approved').length} Tests Approved
            </span>
          </div>
        </div>
      </div>


      {/* 4. Tab 1: Available Tasks Feed */}
      {activeTab === 'available' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Open Testing Opportunities</h2>
            <span className="text-xs text-slate-500 font-medium">Updated in real-time</span>
          </div>

          {listings.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-xl p-12 text-center text-slate-500 shadow-xs space-y-3">
              <p className="text-base font-bold text-slate-800">No open tests right now</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                New testing opportunities are posted regularly. Check back shortly or verify your demographic settings above to receive targeted tests.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="px-4 py-2 bg-[#2955E3] hover:bg-[#1D4ED8] text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
                >
                  Update Demographics Profile
                </button>
              </div>
            </div>
          ) : (
            <>
              {unmatchedCount > 0 && (
                <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100/80 text-[#2955E3] flex items-center justify-center shrink-0">
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-blue-950">
                        {unmatchedCount} targeted {unmatchedCount === 1 ? 'campaign is' : 'campaigns are'} waiting for matching testers
                      </p>
                      <p className="text-blue-800/90 text-[11px] mt-0.5">
                        {isProfileDemographicsIncomplete(profile)
                          ? 'Complete your demographics profile to see if you qualify for targeted campaigns below.'
                          : 'These campaigns require specific demographic criteria shown below. Update your profile if your details have changed.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(true)}
                    className="px-3.5 py-1.5 bg-[#2955E3] hover:bg-[#1D4ED8] text-white font-bold rounded-lg text-xs transition-colors shrink-0 shadow-xs self-start sm:self-auto"
                  >
                    Update Profile
                  </button>
                </div>
              )}
              <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100">
              {listings.map((job) => {
                const isMatched = job.is_demographic_matched !== false
                const isTargeted = isListingTargeted(job)
                const isUnmatched = isTargeted && !isMatched && !job.user_submission_status
                const unmetRequirements = isUnmatched
                  ? (job.unmet_demographics && job.unmet_demographics.length > 0
                      ? job.unmet_demographics
                      : getUnmetDemographicRequirements(job, profile))
                  : []
                const btnConfig = getButtonConfig(job, { isMatched: !isUnmatched })
                const isFull = job.slots_filled >= job.slots_count && !job.user_submission_status

                return (
                  <div 
                    key={job.id} 
                    className={`px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-150 hover:bg-slate-50/60 ${
                      isFull ? 'opacity-60' : ''
                    } ${
                      isUnmatched ? 'bg-slate-50/40 border-l-2 border-l-purple-500' : ''
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-sm truncate">
                          {job.title}
                        </h3>
                        {job.is_quick_impression && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-700 bg-slate-100/90 border border-slate-200/80 shadow-2xs font-mono shrink-0">
                            5s Test
                          </span>
                        )}
                        {isTargeted && (
                          isMatched ? (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-700 bg-slate-100/90 border border-slate-200/80 shadow-2xs font-mono shrink-0">
                              Match
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 shadow-2xs font-mono shrink-0 flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              Targeted Campaign
                            </span>
                          )
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 font-medium">
                        <span className="shrink-0 font-semibold font-mono text-slate-700">
                          {job.slots_filled >= job.slots_count ? 'Slots Full' : `${job.slots_count - job.slots_filled} slots left`}
                        </span>
                        <span className="text-slate-300 select-none">•</span>
                        <span className="line-clamp-1 text-slate-400 font-normal">{job.description}</span>
                        {(job.requires_recording || job.requires_image) && (
                          <>
                            <span className="text-slate-300 select-none">•</span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0 font-mono">
                              {[job.requires_recording && 'Recording', job.requires_image && 'Screenshot'].filter(Boolean).join(' + ')}
                            </span>
                          </>
                        )}
                      </div>

                      {isUnmatched && unmetRequirements.length > 0 && (
                        <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-500 font-mono mr-0.5">
                            Requires:
                          </span>
                          {unmetRequirements.map((req, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50/80 text-purple-800 border border-purple-200/80 font-mono"
                            >
                              {req}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
                      <span className="text-base font-extrabold text-slate-900 font-mono tabular-nums">
                        ₱{job.rate_per_tester.toFixed(2)}
                      </span>
                      {isUnmatched ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsProfileModalOpen(true)}
                            className="px-3.5 py-2 bg-[#2955E3] hover:bg-[#1D4ED8] text-white font-bold text-xs rounded-lg shadow-xs transition-colors shrink-0"
                          >
                            Update Demographics
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsProfileModalOpen(true)}
                            title="Click to update demographics profile"
                            className={`hidden md:inline-flex px-3.5 py-2 font-bold text-xs rounded-lg border text-center transition-all shadow-xs ${btnConfig.className}`}
                          >
                            {btnConfig.text}
                          </button>
                        </div>
                      ) : (
                        <Link
                          href={btnConfig.href}
                          className={`px-3.5 py-2 font-bold text-xs rounded-lg border text-center transition-all shadow-xs ${btnConfig.className}`}
                          onClick={(e) => {
                            if (btnConfig.disabled) {
                              e.preventDefault()
                            }
                          }}
                        >
                          {btnConfig.text}
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
              </div>
            </>
          )}
        </div>
      )}

      {/* 5. Tab 2: My Submissions */}
      {activeTab === 'submissions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Your Submission History</h2>
            <span className="text-xs text-slate-500 font-medium">{submissions.length} total entries</span>
          </div>

          {submissions.length === 0 ? (
            /* Unified Onboarding Hero Card for Testers (Pillar 1 & 2: Single Source of Truth & Zero Fragmentation) */
            <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-xs text-center space-y-6">
              <div className="max-w-md mx-auto space-y-2">
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Start Earning with Your First Test
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Join verified testing opportunities to review apps, test web features, and complete 5-second impressions for cash rewards.
                </p>
              </div>

              {/* 3 Value Anchors (Cognitive Rule of Threes) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto pt-2 text-left">
                <div className="p-4 bg-slate-50/80 border border-slate-200/70 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Guaranteed GCash Payouts</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Pre-funded escrow guarantees prompt payment directly to your verified GCash wallet upon approval.
                  </p>
                </div>

                <div className="p-4 bg-slate-50/80 border border-slate-200/70 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <Video className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Test on Any Device</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Complete tests using your smartphone or desktop with our built-in video and audio screen recorder.
                  </p>
                </div>

                <div className="p-4 bg-slate-50/80 border border-slate-200/70 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>3-Day Review Protection</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Review windows ensure your submissions are reviewed fairly and on time without long delays.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => switchTab('available')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#2955E3] hover:bg-[#1D4ED8] text-white font-bold text-sm rounded-xl shadow-sm transition-all active:scale-[0.98]"
                >
                  <span>Explore Available Tests →</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Submission Lifecycle Tracker */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Submission Lifecycle Tracker</h3>
                <div className="w-full font-sans" style={{ minHeight: '350px' }}>
                  <ErrorBoundary>
                    <Chrono
                      items={[
                        {
                          title: "Claiming",
                          cardTitle: "1. Task Claimed",
                          cardSubtitle: "Slot reserved & work begins",
                          cardDetailedText: "Select and claim open opportunities. You have a window of time to follow instructions, upload screenshots, or start screen recordings."
                        },
                        {
                          title: "Reviewing",
                          cardTitle: "2. Under Review",
                          cardSubtitle: "Quality verification",
                          cardDetailedText: "Once submitted, the campaign poster reviews your functional walks or quick impressions. Review windows expire within 30-60 minutes."
                        },
                        {
                          title: "Settling",
                          cardTitle: "3. Payout Settled / Disbursed",
                          cardSubtitle: "GCash credit transfer",
                          cardDetailedText: "Upon campaign poster approval, escrow funds are automatically released. Disbursed payouts can be instantly withdrawn to your GCash."
                        }
                      ]}
                      mode="VERTICAL"
                      theme={{
                        primary: '#2955E3',
                        secondary: '#E0F2FE',
                        cardBgColor: '#FFFFFF',
                        titleColor: '#0F172A',
                        titleColorActive: '#2955E3',
                      }}
                      cardHeight={80}
                      disableToolbar
                    />
                  </ErrorBoundary>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100">
              {submissions.map((sub) => {
                return (
                  <div key={sub.id} className="px-4 sm:px-5 py-3.5 space-y-3 hover:bg-slate-50/60 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-sm truncate">
                            {sub.listing_title}
                          </h3>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-semibold text-slate-700 bg-slate-100/90 border border-slate-200/80 shadow-2xs font-mono uppercase">
                            {sub.status === 'pending_review' 
                              ? 'Under Review' 
                              : sub.status === 'approved' 
                              ? 'Approved & Paid' 
                              : sub.status === 'disputed' 
                              ? 'In Dispute' 
                              : sub.status === 'rejected' 
                              ? 'Rejected' 
                              : sub.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 font-medium">
                          <span>Submitted on {new Date(sub.submitted_at || sub.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                        <span className="text-base font-extrabold text-slate-900 font-mono tabular-nums">
                          ₱{sub.rate_per_tester.toFixed(2)}
                        </span>
                        <Link
                          href={`/dashboard/tester/tasks/${sub.listing_id}`}
                          className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-all whitespace-nowrap shadow-xs"
                        >
                          Workspace &rarr;
                        </Link>
                      </div>
                    </div>

                    {/* Rejection Details & Dispute Action */}
                    {sub.status === 'rejected' && (
                      <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-4 text-xs space-y-2.5 ml-5 mt-2">
                        <div className="font-bold text-rose-900 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          <span>Rejection Category: {formatRejectionReason(sub.rejection_reason)}</span>
                        </div>
                        {sub.rejection_explanation && (
                          <p className="text-rose-950 italic bg-white/70 p-2.5 rounded-lg border border-rose-100">
                            &quot;{sub.rejection_explanation}&quot;
                          </p>
                        )}
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleOpenDispute(sub.id, sub.listing_title)}
                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" /> Submit Rejection Dispute
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Dispute Details */}
                    {sub.status === 'disputed' && (
                      <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-4 text-xs space-y-1.5 ml-5 mt-2">
                        <div className="font-bold text-orange-900 flex items-center gap-1.5">
                          <Scale className="w-4 h-4 text-orange-700" /> Dispute Reason: {formatDisputeReason(sub.dispute_reason)}
                        </div>
                        {sub.dispute_explanation && (
                          <p className="text-orange-950 italic bg-white/70 p-2.5 rounded-lg border border-orange-100">
                            &quot;{sub.dispute_explanation}&quot;
                          </p>
                        )}
                        <span className="text-[11px] text-orange-800 font-medium block pt-0.5">
                          Support team is reviewing this dispute. Escrow remains held.
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
          )}
        </div>
      )}

      {/* 6. Tab 3: Earnings & Payout Ledger */}
      {activeTab === 'earnings' && (
        <div className="space-y-6">
          {/* Payout Accumulations Chart (dynamic disclosure) */}
          {payouts.length > 0 && (
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Payout Accumulations (Last Month)</h3>
              <div className="h-64">
                <ErrorBoundary>
                  <LineChart
                    className="h-full"
                    data={[
                      { date: 'Jul 15', 'Payout Accumulation': 1000 },
                      { date: 'Jul 20', 'Payout Accumulation': 1200 },
                      { date: 'Jul 25', 'Payout Accumulation': 1500 },
                      { date: 'Jul 30', 'Payout Accumulation': 1800 },
                      { date: 'Aug 04', 'Payout Accumulation': 2000 },
                      { date: 'Aug 09', 'Payout Accumulation': 2400 },
                      { date: 'Aug 15', 'Payout Accumulation': 2800 }
                    ]}
                    index="date"
                    categories={['Payout Accumulation']}
                    colors={['emerald']}
                    valueFormatter={(number) => `₱${number.toLocaleString('en-PH')}`}
                    yAxisWidth={60}
                  />
                </ErrorBoundary>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
              <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider mb-1">Withdrawable Balance</span>
              <span className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight">₱{withdrawableBalance.toFixed(2)}</span>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
              <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider mb-1">Total Earnings</span>
              <span className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight">₱{totalEarnedValue.toFixed(2)}</span>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
              <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider mb-1">Completed Payouts</span>
              <span className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight">{payouts.filter(p => p.status === 'completed').length} Transactions</span>
            </div>
          </div>

          {/* Payout History Table */}
          <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200/80 bg-slate-50/60 flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900">GCash Payout History</h3>
              <span className="text-xs text-slate-500 font-medium">{payouts.length} transactions</span>
            </div>

            {payouts.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <Wallet className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No payout transactions yet</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  When you withdraw your testing earnings to GCash, your disbursements will be recorded here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/80">
                    <tr>
                      <th className="p-4">Reference ID</th>
                      <th className="p-4">Date & Time</th>
                      <th className="p-4">Destination GCash</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {payouts.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-mono font-bold text-slate-900">{p.reference_id}</td>
                        <td className="p-4 text-slate-500 font-mono tabular-nums">{new Date(p.created_at).toLocaleString()}</td>
                        <td className="p-4 text-slate-700 font-mono tabular-nums">{maskGcashNumber(p.gcash_number)}</td>
                        <td className="p-4 font-extrabold text-emerald-700 font-mono tabular-nums">+₱{p.amount.toFixed(2)}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100/90 text-slate-700 border border-slate-200/80 font-bold uppercase text-[10px] shadow-2xs font-mono">
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={profile}
        onSaveProfile={handleUpdateProfile}
      />

      {/* Dispute Modal */}
      <DisputeModal
        isOpen={disputeModalState.isOpen}
        onClose={() => setDisputeModalState(prev => ({ ...prev, isOpen: false }))}
        submissionId={disputeModalState.submissionId}
        listingTitle={disputeModalState.listingTitle}
        onSubmitDispute={handleDisputeSubmit}
      />

      {/* Payout Modal */}
      {mounted && createPortal(
        <AnimatePresence>
          {showPayoutModal && (
            <motion.div 
              key="tester-gcash-payout-backdrop"
              variants={modalBackdropVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              role="dialog"
              aria-modal="true"
              aria-labelledby="tester-gcash-payout-title"
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            >
              <motion.div 
                key="tester-gcash-payout-card"
                variants={modalContentVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
                  <h3 id="tester-gcash-payout-title" className="font-extrabold text-lg flex items-center gap-2 text-slate-900">
                    <Wallet className="w-5 h-5 text-[#2955E3]" aria-hidden="true" /> GCash Payout
                  </h3>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowPayoutModal(false)
                      setPayoutSuccess(false)
                      setPayoutError(null)
                      setPayoutGcashNumber('')
                    }}
                    aria-label="Close GCash payout modal"
                    className="text-slate-400 hover:text-slate-600 text-2xl font-medium p-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2955E3]"
                  >
                    &times;
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {payoutSuccess ? (
                    <div role="status" aria-live="polite" className="text-center space-y-3 py-4">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                        <CheckCircle className="w-6 h-6" aria-hidden="true" />
                      </div>
                      <h4 className="font-bold text-slate-900 text-base">GCash Number Saved!</h4>
                      <p className="text-xs text-slate-600">Your GCash number is verified. Payments will be sent straight to this number whenever your test submissions are approved.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleRequestPayout} className="space-y-4">
                      <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center border border-slate-200/70">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Current GCash</span>
                        <span className="text-sm font-mono font-extrabold text-[#2955E3] tabular-nums">{payoutGcashNumber || gcashNumber || 'Not set'}</span>
                      </div>

                      <div>
                        <label htmlFor="tester-gcash-input" className="block text-xs font-bold text-slate-700 mb-1.5">Enter your 11-digit GCash Number</label>
                        <input
                          id="tester-gcash-input"
                          type="text"
                          required
                          value={payoutGcashNumber}
                          onChange={e => setPayoutGcashNumber(e.target.value)}
                          placeholder="09XXXXXXXXX"
                          className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus-border-[#2955E3] focus:ring-1 focus:ring-[#2955E3] focus-visible:ring-2 focus-visible:ring-[#2955E3]"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">Your rewards will be sent automatically to this GCash number once your test is approved.</p>
                      </div>

                      {payoutError && (
                        <div role="alert" className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-lg flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
                          <span>{payoutError}</span>
                        </div>
                      )}

                      <div className="pt-2 flex justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPayoutModal(false)
                            setPayoutError(null)
                            setPayoutGcashNumber('')
                          }}
                          className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={payoutLoading}
                          className="px-5 py-2 bg-[#2955E3] hover:bg-[#1E40AF] text-white rounded-lg text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2955E3]"
                        >
                          {payoutLoading ? 'Saving...' : 'Save GCash Account'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

export default function TesterDashboard() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 text-xs font-mono">Loading workspace...</div>}>
      <TesterDashboardContent />
    </Suspense>
  )
}
