'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import Tilt from 'react-parallax-tilt'
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
  Copy
} from 'lucide-react'
import { ProfileModal } from '@/components/shared/ProfileModal'
import { DisputeModal } from '@/components/shared/DisputeModal'
import { createBrowserClient } from '@/lib/supabase/client'
import { sanitizeDatabaseError } from '@/lib/utils/error'
import { JobListing, getButtonConfig } from '@/lib/utils/claim-button'
import { formatRejectionReason, formatDisputeReason } from '@/lib/utils/workspace-status'
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

const DEFAULT_SUBMISSIONS: SubmissionRecord[] = [
  {
    id: 'sub_1',
    listing_id: 'j1',
    listing_title: 'E-Commerce App GCash Checkout Test',
    rate_per_tester: 200,
    status: 'approved',
    submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString()
  },
  {
    id: 'sub_2',
    listing_id: 'j2',
    listing_title: 'Rider Delivery App Pin Accuracy Verification',
    rate_per_tester: 500,
    status: 'rejected',
    rejection_reason: 'instructions_not_followed',
    rejection_explanation: 'The GPS pin locator screenshot was blurry and did not show exact coordinates.',
    submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString()
  },
  {
    id: 'sub_3',
    listing_id: 'j3',
    listing_title: 'Sari-Sari Store Inventory App Initial Run',
    rate_per_tester: 50,
    status: 'pending_review',
    submitted_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString()
  }
]

const DEFAULT_PAYOUTS: PayoutRecord[] = [
  {
    id: 'p_1',
    reference_id: 'PAY-GCASH-9821',
    amount: 200,
    gcash_number: '0917-***-5678',
    status: 'completed',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString()
  },
  {
    id: 'p_2',
    reference_id: 'PAY-GCASH-4412',
    amount: 200,
    gcash_number: '0917-***-5678',
    status: 'completed',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString()
  }
]

const maskGcashNumber = (num: string) => {
  if (!num) return '0917-***-5678'
  if (num.includes('***')) return num
  const cleaned = num.replace(/[-\s]/g, '')
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 4)}-***-${cleaned.slice(7)}`
  }
  return num
}

const getLast4OfGcash = (num: string) => {
  if (!num) return '5678'
  const cleaned = num.replace(/[-\s]/g, '')
  if (cleaned.length >= 4) {
    return cleaned.slice(-4)
  }
  return '5678'
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
  const [gcashNumber, setGcashNumber] = useState('0917-***-5678')
  const [profile, setProfile] = useState<Partial<UserProfile> | null>(null)
  const [copiedText, setCopiedText] = useState<'card' | 'gcash' | null>(null)

  const handleCopy = (text: string, type: 'card' | 'gcash') => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedText(type)
    setTimeout(() => setCopiedText(null), 1500)
  }
  const [listings, setListings] = useState<JobListing[]>([])
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>(DEFAULT_SUBMISSIONS)
  const [payouts, setPayouts] = useState<PayoutRecord[]>(DEFAULT_PAYOUTS)
  const [loading, setLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)

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
    router.push(`/dashboard/tester?tab=${tab}`)
  }

  const fetchProfileAndListings = useCallback(async () => {
    setLoading(true)
    setLoadingError(null)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        setLoadingError('Authentication required.')
        setLoading(false)
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
              profileData = { id: user.id, role: 'tester', age_group: '', gender: '', employment_status: '', tech_literacy: '', accessibility_tags: [] }
              profileError = null
            }
          } catch {
            profileData = { id: user.id, role: 'tester', age_group: '', gender: '', employment_status: '', tech_literacy: '', accessibility_tags: [] }
            profileError = null
          }
        } else if (profileError.message?.includes('profiles') || profileError.message?.includes('schema cache')) {
          profileData = { id: user.id, role: 'tester', age_group: '', gender: '', employment_status: '', tech_literacy: '', accessibility_tags: [] }
          profileError = null
        }
      }

      if (profileError || !profileData) {
        setLoadingError(sanitizeDatabaseError(profileError, 'Failed to retrieve user profile.'))
        setLoading(false)
        return
      }

      setProfile(profileData)
      if ((profileData as any)?.phone) {
        setGcashNumber((profileData as any).phone)
      }

      // Fetch tester earnings & payouts
      try {
        const { data: payoutsData } = await supabase
          .from('payouts')
          .select('*')
          .eq('tester_id', user.id)
          .order('created_at', { ascending: false })

        if (payoutsData && payoutsData.length > 0) {
          setPayouts(payoutsData.map((p: any) => ({
            id: p.id,
            reference_id: p.reference_id || `PAY-GCASH-${p.id.slice(0, 4)}`,
            amount: p.amount,
            gcash_number: p.gcash_number || '0917-***-5678',
            status: p.status || 'completed',
            created_at: p.created_at
          })))
          const totalPaid = payoutsData
            .filter((p: any) => p.status === 'completed')
            .reduce((sum: number, p: any) => sum + p.amount, 0)
          setTotalEarnings(totalPaid)
          setWithdrawableBalance(Math.max(0, totalPaid))
        }
      } catch (err) {
        console.warn('Payouts query fallback:', err)
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

        if (userSubsData && userSubsData.length > 0) {
          const mappedSubs: SubmissionRecord[] = userSubsData.map((s: any) => ({
            id: s.id,
            listing_id: s.listing_id,
            listing_title: s.listings?.title || 'Testing Listing Task',
            rate_per_tester: s.listings?.rate_per_tester || 150,
            status: s.status,
            rejection_reason: s.rejection_reason,
            rejection_explanation: s.rejection_explanation,
            dispute_reason: s.dispute_reason,
            dispute_explanation: s.dispute_explanation,
            submitted_at: s.submitted_at,
            created_at: s.created_at
          }))
          setSubmissions(mappedSubs)
        }
      } catch (err) {
        console.warn('User submissions fetch fallback:', err)
      }

      // 3. Fetch open listings
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
        .eq('status', 'open')

      if (listingsError) {
        setLoadingError(sanitizeDatabaseError(listingsError, 'Failed to load listings.'))
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

        const mapped = (listingsData || []).map((listing: any) => {
          const firstTask = listing.tasks?.[0]
          const userSub = userSubmissions.find((s) => s.listing_id === listing.id)
          const userSubmissionStatus = (userSub ? userSub.status : null) as any

          return {
            id: listing.id,
            title: listing.title,
            description: listing.description,
            rate_per_tester: listing.rate_per_tester,
            slots_count: listing.slots_count,
            slots_filled: listing.submissions 
              ? listing.submissions.filter((s: any) => s.status !== 'expired' && s.status !== 'rejected').length 
              : 0,
            requires_recording: listing.tasks?.some((t: any) => t.requires_recording) || false,
            requires_image: listing.tasks?.some((t: any) => t.requires_image) || false,
            question_text: firstTask?.question_text || 'Provide feedback on this design.',
            is_quick_impression: listing.is_quick_impression,
            target_age_group: listing.target_age_group,
            target_gender: listing.target_gender,
            target_employment_status: listing.target_employment_status,
            target_tech_literacy: listing.target_tech_literacy,
            target_accessibility_tags: listing.target_accessibility_tags,
            user_submission_status: userSubmissionStatus,
            site_url: listing.site_url,
          }
        })

        // Filter based on demographic match
        const filtered = mapped.filter((listing: any) => {
          if (listing.target_age_group && listing.target_age_group !== profileData?.age_group) return false
          if (listing.target_gender && listing.target_gender !== profileData?.gender) return false
          if (listing.target_employment_status && listing.target_employment_status !== profileData?.employment_status) return false
          if (listing.target_tech_literacy && listing.target_tech_literacy !== profileData?.tech_literacy) return false
          
          if (listing.target_accessibility_tags && listing.target_accessibility_tags.length > 0) {
            const testerTags = profileData?.accessibility_tags || []
            const matchesAll = listing.target_accessibility_tags.every((tag: string) => testerTags.includes(tag))
            if (!matchesAll) return false
          }
          return true
        })

        setListings(filtered)
      }
    } catch (err) {
      setLoadingError(sanitizeDatabaseError(err, 'An error occurred.'))
    } finally {
      setLoading(false)
      setIsInitialLoad(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchProfileAndListings()
  }, [fetchProfileAndListings])

  const handleUpdateProfile = async (updatedData: Partial<UserProfile>) => {
    if (!profile?.id) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updatedData)
        .eq('id', profile.id)

      if (error && !error.message?.includes('profiles') && !error.message?.includes('schema cache')) {
        throw error
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
  const activeJob = listings.find(l => l.user_submission_status === 'in_progress' || (activeSubmission && l.id === activeSubmission.listing_id))
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
            Welcome back, {profile?.full_name || 'Tester'}. Ready to claim new testing opportunities today?
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-2"
          >
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span>Profile & Notifications</span>
          </button>
          <button
            onClick={() => setShowPayoutModal(true)}
            className="bg-[#2955E3] hover:bg-[#1D4ED8] text-white font-semibold px-4 py-2 rounded-lg text-sm shadow-sm transition-all flex items-center gap-1.5"
          >
            <Wallet className="w-4 h-4" />
            <span>Cash Out to GCash</span>
          </button>
        </div>
      </div>

      {/* 2. Top 3-Card Financial & Status Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Available Balance & Destination GCash */}
        <Tilt
          className="perspective-1000"
          perspective={1000}
          glareEnable={true}
          glareMaxOpacity={0.15}
          glareColor="#ffffff"
          glarePosition="all"
          scale={1.02}
        >
          <div 
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #070a1e 100%)' }}
            className="text-white border border-slate-700/80 rounded-xl p-5 shadow-lg min-h-[190px] flex flex-col justify-between relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Available for Withdrawal
                </span>
                <div className="font-mono text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  ₱{withdrawableBalance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div 
                style={{ background: 'linear-gradient(90deg, #fbbf24 0%, #fef08a 100%)' }}
                className="w-10 h-7 rounded border border-amber-500/30 relative overflow-hidden flex flex-col justify-between p-1 shrink-0"
              >
                <div className="flex justify-between w-full h-full">
                  <div className="w-2.5 h-full border-r border-amber-700/30"></div>
                  <div className="w-2.5 h-full border-l border-r border-amber-700/30"></div>
                  <div className="w-2.5 h-full border-l border-amber-700/30"></div>
                </div>
                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-amber-700/30 -translate-y-1/2"></div>
              </div>
            </div>

            <div className="my-2 flex items-center justify-between gap-2">
              <div className="font-mono text-sm tracking-[0.2em] text-indigo-200/80 font-medium">
                5243 0917 •••• {getLast4OfGcash(gcashNumber || (profile as any)?.phone || '')}
              </div>
              <div className="h-5 flex items-center">
                {copiedText === 'card' ? (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 animate-in fade-in duration-200">
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCopy(`5243 0917 ${getLast4OfGcash(gcashNumber || (profile as any)?.phone || '')}`, 'card')}
                    className="text-indigo-200/60 hover:text-white p-1 rounded-md hover:bg-slate-800/50 transition-all active:scale-95"
                    title="Copy Card Number"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-700/50 pt-3">
              <div className="truncate flex-1">
                <span className="text-[9px] text-slate-400 block font-medium uppercase tracking-wider">Cardholder / GCash</span>
                <span className="text-xs font-mono font-bold tracking-wider text-slate-100 truncate block">
                  {(profile?.full_name || 'TESTER').toUpperCase()}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 h-4">
                  <span className="text-[10px] font-mono text-slate-300 block">
                    {maskGcashNumber(gcashNumber || (profile as any)?.phone || '')}
                  </span>
                  <div className="flex items-center">
                    {copiedText === 'gcash' ? (
                      <span className="text-[9px] text-emerald-400 font-semibold flex items-center gap-0.5 animate-in fade-in duration-200">
                        <Check className="w-3 h-3 text-emerald-400" /> Copied
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCopy(gcashNumber || (profile as any)?.phone || '', 'gcash')}
                        className="text-slate-400 hover:text-white p-0.5 rounded transition-all active:scale-95"
                        title="Copy GCash Number"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowPayoutModal(true)}
                disabled={withdrawableBalance <= 0}
                className="bg-white hover:bg-slate-100 disabled:opacity-55 disabled:hover:bg-white disabled:cursor-not-allowed text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs shadow-xs transition-all shrink-0"
              >
                Cash Out
              </button>
            </div>
          </div>
        </Tilt>

        {/* Card 2: Active Slot & Task In Progress */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all hover-lift hover:shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Active Test Session
              </span>
              {hasActiveTask ? (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
              ) : (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              )}
            </div>
            {hasActiveTask ? (
              <div className="mt-2.5 space-y-1">
                <h4 className="font-bold text-sm text-slate-900 truncate">
                  {activeTaskTitle}
                </h4>
                <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Active slot reserved • Complete test</span>
                </div>
              </div>
            ) : (
              <div className="mt-2.5 space-y-0.5">
                <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <span>Ready for New Tasks</span>
                </div>
                <p className="text-xs text-slate-500">
                  Claim an open opportunity to start earning.
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
                <span>Resume Task →</span>
              </Link>
            ) : (
              <button
                onClick={() => switchTab('available')}
                className="text-xs font-bold text-[#2955E3] hover:text-[#1D4ED8] flex items-center gap-1 transition-colors"
              >
                <span>Explore Open Tests</span>
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
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle className="w-3 h-3 text-emerald-600" /> Verified
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
              {payouts.filter(p => p.status === 'completed').length} Payouts Disbursed • {submissions.filter(s => s.status === 'approved').length} Tests Approved
            </span>
          </div>
        </div>
      </div>


      {/* 4. Tab 1: Available Tasks Feed */}
      {activeTab === 'available' && (
        <div className="space-y-6">
          {/* Welcome Back Continuity Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Since your last session:
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                <span>Session Continuity</span>
              </span>
            </div>
            <div className="mt-3 text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
              {"Since your last session: ₱200.00 GCash Payout successfully credited, 1 submission approved by Poster, 0 security flags detected."}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200/60 mt-4">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>₱200.00 GCash Payout credited</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>1 submission approved by Poster</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0" />
                <span>0 security flags detected</span>
              </div>
            </div>
          </div>

          {/* Personalized Financial Insights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Earning Target Progress Card */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Earning Target Progress
                  </span>
                  <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                    <Target className="w-4 h-4" />
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-2xl font-extrabold text-slate-900 font-mono">
                      ₱2,800.00
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      of ₱5,000.00 target
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '56%' }} />
                    </div>
                    <div className="flex justify-between text-[11px] font-medium text-slate-500">
                      <span>56% complete</span>
                      <span>₱2,200.00 remaining</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Progress Milestones */}
              <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Progress Milestones
                </span>
                <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold text-slate-500">
                  <div className="flex items-center gap-1 text-emerald-600">
                    <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span>₱1,500 reached</span>
                  </div>
                  <div className="flex items-center gap-1 text-blue-600">
                    <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                    <span>₱3,000 next</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>₱5,000 goal</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contextual Discovery Card */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Contextual Discovery
                  </span>
                  <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                    <AlertCircle className="w-4 h-4" />
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-lg">
                    <p className="text-xs text-blue-900 font-medium leading-relaxed font-mono">
                      {"You haven't completed: Functional checkout walks. Try one to earn higher rewards."}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Update your profile demographics and preferences to unlock specialized checkout testing jobs.
                  </p>
                </div>
              </div>
              
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#2955E3] hover:text-[#1D4ED8] transition-colors"
                >
                  <span>Update Profile Demographics</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Open Testing Opportunities</h2>
              <span className="text-xs text-slate-500 font-medium">Updated in real-time</span>
            </div>

          {listings.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-xl p-12 text-center text-slate-500 shadow-xs space-y-4">
              <p className="text-base font-bold text-slate-800">No matching tasks found</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Try configuring your profile demographics to unlock more target-matched jobs.
              </p>
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="px-4 py-2 bg-[#2955E3] hover:bg-[#1D4ED8] text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
              >
                Update Demographics Profile
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100">
              {listings.map((job) => {
                const btnConfig = getButtonConfig(job)
                const isFull = job.slots_filled >= job.slots_count && !job.user_submission_status
                return (
                  <div 
                    key={job.id} 
                    className={`px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-150 hover:bg-slate-50/60 ${
                      isFull ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Glowing Dot representing vacancy/claim status */}
                      <span className="relative flex h-2 w-2 shrink-0">
                        {isFull ? (
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-300"></span>
                        ) : job.user_submission_status ? (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                          </>
                        ) : (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </>
                        )}
                      </span>

                      {/* Icon Circle */}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                        job.is_quick_impression 
                          ? 'bg-amber-50 text-amber-600 border-amber-100/60'
                          : job.requires_recording
                            ? 'bg-purple-50 text-purple-600 border-purple-100/60'
                            : 'bg-blue-50 text-blue-600 border-blue-100/60'
                      }`}>
                        {job.is_quick_impression ? (
                          <Zap className="w-4 h-4" />
                        ) : job.requires_recording ? (
                          <Video className="w-4 h-4" />
                        ) : job.site_url?.includes('app') ? (
                          <Smartphone className="w-4 h-4" />
                        ) : (
                          <Globe className="w-4 h-4" />
                        )}
                      </div>
                      
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                          <span className="truncate">{job.title}</span>
                          {job.is_quick_impression && (
                            <span className="text-[9px] font-extrabold tracking-wider uppercase bg-amber-50 text-amber-800 border border-amber-200/50 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                              <Zap className="w-2.5 h-2.5 text-amber-500" /> 5s
                            </span>
                          )}
                          {(job.target_age_group || job.target_gender || job.target_employment_status || job.target_tech_literacy) && (
                            <span className="text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-100/50 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                              <Target className="w-2.5 h-2.5 text-purple-500" /> Match
                            </span>
                          )}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 font-medium">
                          <span className="shrink-0 font-semibold">{job.slots_filled >= job.slots_count ? 'Slots Full' : `${job.slots_count - job.slots_filled} slots left`}</span>
                          <span className="text-slate-300 select-none">•</span>
                          <span className="line-clamp-1 text-slate-400 font-normal">{job.description}</span>
                          {(job.requires_recording || job.requires_image) && (
                            <>
                              <span className="text-slate-300 select-none">•</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0">
                                {[job.requires_recording && 'Recording', job.requires_image && 'Screenshot'].filter(Boolean).join(' + ')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      <span className="text-base font-extrabold text-slate-900 font-mono tabular-nums">
                        ₱{job.rate_per_tester.toFixed(2)}
                      </span>
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
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          </div>
        </div>
      )}

      {/* 5. Tab 2: My Submissions */}
      {activeTab === 'submissions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Your Submission History</h2>
            <span className="text-xs text-slate-500 font-medium">{submissions.length} total entries</span>
          </div>

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

          {submissions.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-xl p-12 text-center text-slate-500 shadow-xs space-y-3">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-base font-semibold text-slate-700">No submissions found</p>
              <p className="text-xs text-slate-400">Claim an available task to start earning rewards.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100">
              {submissions.map((sub) => {
                return (
                  <div key={sub.id} className="px-4 sm:px-5 py-3.5 space-y-3 hover:bg-slate-50/60 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* Glowing Status Dot */}
                        <span className="relative flex h-2 w-2 shrink-0">
                          {sub.status === 'approved' && (
                            <>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </>
                          )}
                          {sub.status === 'pending_review' && (
                            <>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </>
                          )}
                          {sub.status === 'disputed' && (
                            <>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                            </>
                          )}
                          {(sub.status === 'rejected' || sub.status === 'expired') && (
                            <>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                            </>
                          )}
                        </span>

                        <div className="space-y-0.5 min-w-0 flex-1">
                          <h3 className="font-bold text-slate-900 text-sm truncate">
                            {sub.listing_title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 font-medium">
                            <span>Submitted on {new Date(sub.submitted_at || sub.created_at).toLocaleDateString()}</span>
                            <span className="text-slate-300">•</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase border ${
                              sub.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              sub.status === 'pending_review' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                              sub.status === 'disputed' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                              'bg-rose-50 text-rose-700 border-rose-100'
                            }`}>
                              {sub.status === 'pending_review' ? 'Under Review' : sub.status}
                            </span>
                          </div>
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
          )}
        </div>
      )}

      {/* 6. Tab 3: Earnings & Payout Ledger */}
      {activeTab === 'earnings' && (
        <div className="space-y-6">
          {/* Payout Accumulations Chart */}
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
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold uppercase text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
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
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
              <h3 className="font-extrabold text-lg flex items-center gap-2 text-slate-900">
                <Wallet className="w-5 h-5 text-[#2955E3]" /> GCash Payout
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setShowPayoutModal(false)
                  setPayoutSuccess(false)
                  setPayoutError(null)
                  setPayoutGcashNumber('')
                }}
                className="text-slate-400 hover:text-slate-600 text-xl font-medium p-1 rounded-md"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4">
              {payoutSuccess ? (
                <div className="text-center space-y-3 py-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-base">GCash Account Verified!</h4>
                  <p className="text-xs text-slate-500">Your GCash mobile number has been saved. Payouts for approved submissions are automatically credited to this number.</p>
                </div>
              ) : (
                <form onSubmit={handleRequestPayout} className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center border border-slate-200/70">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Registered GCash</span>
                    <span className="text-sm font-mono font-extrabold text-[#2955E3] tabular-nums">{payoutGcashNumber || gcashNumber || 'Unset'}</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Update GCash Payout Mobile Number</label>
                    <input
                      type="text"
                      required
                      value={payoutGcashNumber}
                      onChange={e => setPayoutGcashNumber(e.target.value)}
                      placeholder="09XXXXXXXXX"
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#2955E3] focus:ring-1 focus:ring-[#2955E3]"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">SubukAn automatically disburses ₱ per task directly to this GCash number upon approval.</p>
                  </div>

                  {payoutError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
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
                      className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-xs font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={payoutLoading}
                      className="px-4 py-2 bg-[#2955E3] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-2 transition-colors"
                    >
                      {payoutLoading ? 'Saving...' : 'Save GCash Number'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
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
