'use client'

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import Tilt from 'react-parallax-tilt'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { 
  Plus, 
  Wallet, 
  Users, 
  AlertCircle, 
  FileText, 
  Check, 
  Copy, 
  Download, 
  ShieldCheck, 
  CheckCircle2, 
  Search, 
  Eye, 
  EyeOff, 
  ExternalLink,
  Layers,
  Clock,
  TrendingDown
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { sanitizeDatabaseError } from '@/lib/utils/error'
import CreateCampaignModal from '@/components/poster/CreateCampaignModal'
import dynamic from 'next/dynamic'
import { AreaChart } from '@tremor/react'
import Cards from 'react-credit-cards-2'
import 'react-credit-cards-2/dist/es/styles-compiled.css'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

const Chrono = dynamic(() => import('react-chrono').then(mod => mod.Chrono), { ssr: false })

interface Listing {
  id: string;
  poster_id: string;
  title: string;
  description: string;
  site_url: string;
  rate_per_tester: number;
  slots_count: number;
  slots_filled: number;
  total_budget: number;
  status: string;
  review_window_minutes: 30 | 60;
  created_at: string;
  updated_at: string;
}

function PosterDashboardContent() {
  const supabase = createBrowserClient()

  const [user, setUser] = useState<any>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalInitialValues, setModalInitialValues] = useState<any>(null)

  const [profile, setProfile] = useState<any>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  const tabParam = searchParams.get('tab') || 'overview'
  const validTabs = ['overview', 'listings', 'settings']
  const activeTab = validTabs.includes(tabParam) ? tabParam : 'overview'

  // Listings filter & search state
  const [listingFilter, setListingFilter] = useState<'all' | 'active' | 'review' | 'released'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Settings form state
  const [paymentSettings, setPaymentSettings] = useState({
    sandbox_mode: true,
    paymongo_public_key: '',
    paymongo_secret_key: '',
    gcash_payout_number: ''
  })
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState<'pub' | 'sec' | 'gcash' | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  // Credit card state
  const [cardState, setCardState] = useState({
    number: '',
    name: '',
    expiry: '',
    cvc: '',
    focus: '' as any
  })

  const handleCardInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    let formattedValue = value
    if (name === 'number') {
      formattedValue = value.replace(/\D/g, '').substring(0, 16)
    } else if (name === 'expiry') {
      formattedValue = value.replace(/\D/g, '').substring(0, 4)
    } else if (name === 'cvc') {
      formattedValue = value.replace(/\D/g, '').substring(0, 4)
    }
    setCardState(prev => ({ ...prev, [name]: formattedValue }))
  }

  const handleCardInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setCardState(prev => ({ ...prev, focus: e.target.name }))
  }

  const fetchUserAndListings = useCallback(async () => {
    setLoading(true)
    setLoadingError(null)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        setLoadingError('You must be authenticated to view this page.')
        setLoading(false)
        return
      }

      setUser(user)

      const { data: profileData } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      if (profileData) setProfile(profileData)

      const { data: paymentData } = await supabase.from('poster_payment_settings').select('payment_settings').eq('id', user.id).single()
      if (paymentData?.payment_settings) {
        setPaymentSettings(prev => ({ ...prev, ...paymentData.payment_settings }))
      }

      const { data, error } = await supabase
        .from('listings')
        .select(`*, submissions(id, status)`)
        .eq('poster_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        setLoadingError(sanitizeDatabaseError(error, 'Failed to retrieve listings.'))
      } else {
        const mappedListings = (data || []).map((listing: any) => ({
          ...listing,
          slots_filled: listing.submissions 
            ? listing.submissions.filter((s: any) => s.status !== 'expired' && s.status !== 'rejected').length 
            : 0
        }))
        setListings(mappedListings)
      }
    } catch (err) {
      setLoadingError(sanitizeDatabaseError(err, 'Failed to retrieve listings.'))
    } finally {
      setLoading(false)
      setIsInitialLoad(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchUserAndListings()
  }, [fetchUserAndListings])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSettingsSaving(true)
    setSettingsSuccess(null)
    setSettingsError(null)
    try {
      const { error } = await supabase.from('poster_payment_settings').upsert({ id: user.id, payment_settings: paymentSettings })
      if (error) throw error
      setSettingsSuccess('Payment settings updated successfully!')
      setTimeout(() => setSettingsSuccess(null), 4000)
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to update payment settings.')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleCopy = (text: string, keyName: 'pub' | 'sec' | 'gcash') => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedKey(keyName)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  // Escrow & metric calculations
  const activeListings = listings.filter(l => l.status !== 'released' && l.status !== 'expired')
  const totalEscrow = activeListings.reduce((sum, l) => sum + l.total_budget, 0)
  const calculateUnallocated = () => 0
  const activeCampaignsCount = activeListings.length
  const totalFilledSlots = listings.reduce((sum, l) => sum + (l.slots_filled || 0), 0)
  const totalCountSlots = listings.reduce((sum, l) => sum + (l.slots_count || 0), 0)
  const slotUtilizationRate = totalCountSlots > 0 ? Math.round((totalFilledSlots / totalCountSlots) * 100) : 0
  const spentPayouts = listings.filter(l => l.status === 'released').reduce((sum, l) => sum + l.total_budget, 0)
  const releasedCampaignsCount = listings.filter(l => l.status === 'released').length
  const reviewCampaignsCount = listings.filter(l => l.status === 'review').length

  // Filtered listings for Listings Tab
  const filteredListings = useMemo(() => {
    return listings.filter(l => {
      // Status filter
      if (listingFilter === 'active' && (l.status === 'released' || l.status === 'expired')) return false
      if (listingFilter === 'review' && l.status !== 'review') return false
      if (listingFilter === 'released' && l.status !== 'released') return false

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        return l.title.toLowerCase().includes(query) || l.description?.toLowerCase().includes(query)
      }

      return true
    })
  }, [listings, listingFilter, searchQuery])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-sky-700 font-medium bg-sky-50 border border-sky-200/60 rounded-md px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>Open / Funding
          </span>
        )
      case 'filling':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium bg-amber-50 border border-amber-200/60 rounded-md px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>Active (Filling)
          </span>
        )
      case 'review':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-purple-700 font-medium bg-purple-50 border border-purple-200/60 rounded-md px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>Under Review
          </span>
        )
      case 'released':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-200/60 rounded-md px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Released
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-rose-700 font-medium bg-rose-50 border border-rose-200/60 rounded-md px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Rejected
          </span>
        )
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-100 border border-slate-200 rounded-md px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Expired
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-100 border border-slate-200 rounded-md px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>{status || 'Unknown'}
          </span>
        )
    }
  }

  const handleDuplicateListing = (listing: Listing) => {
    setModalInitialValues(listing)
    setIsModalOpen(true)
  }

  const handleDownloadReceipt = (listing: Listing) => {
    const receiptDate = new Date().toISOString().split('T')[0]
    const createdDate = formatDate(listing.created_at)
    const statusLabel = listing.status.charAt(0).toUpperCase() + listing.status.slice(1)
    const amountPaid = listing.status === 'released' ? listing.total_budget : 0

    const receiptContent = [
      '═══════════════════════════════════════════',
      '           subukAn — Spend Receipt         ',
      '═══════════════════════════════════════════',
      '',
      `Receipt Date:      ${receiptDate}`,
      `Listing ID:        ${listing.id}`,
      `Listing Title:     ${listing.title}`,
      `Created:           ${createdDate}`,
      '',
      '───────────────────────────────────────────',
      '  Financial Summary',
      '───────────────────────────────────────────',
      '',
      `Rate per Tester:   ₱${listing.rate_per_tester}`,
      `Total Slots:       ${listing.slots_count}`,
      `Slots Filled:      ${listing.slots_filled}`,
      `Escrow Budget:     ₱${listing.total_budget.toLocaleString()}`,
      `Amount Paid Out:   ₱${amountPaid.toLocaleString()}`,
      `Listing Status:    ${statusLabel}`,
      '',
      '───────────────────────────────────────────',
      '',
      'This receipt is generated for record-keeping purposes.',
      'For disputes or questions, contact support@subukan.ph',
      '',
      '═══════════════════════════════════════════',
    ].join('\n')

    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `subukan-receipt-${listing.id.slice(0, 8)}-${receiptDate}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toISOString().split('T')[0]
    } catch {
      return dateString
    }
  }

  if (loading && isInitialLoad) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-[#2955E3] mx-auto"></div>
          <p className="text-slate-500 font-medium text-sm animate-pulse">Loading Poster Workspace...</p>
        </div>
      </div>
    )
  }

  if (loadingError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="bg-white border border-rose-200 rounded-xl p-6 max-w-md w-full shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900">Failed to Load Workspace</h3>
            <p className="text-sm text-slate-500 mt-1">{loadingError}</p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => fetchUserAndListings()}
              className="px-4 py-2 bg-[#2955E3] hover:bg-[#1D4ED8] text-white font-semibold text-sm rounded-lg transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderTable = (data: Listing[]) => (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        {data.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-4">
            <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
              <FileText className="w-7 h-7" />
            </div>
            <div className="max-w-sm mx-auto space-y-1">
              <p className="font-bold text-base text-slate-900">No campaigns found</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Launch your first usability test or 5-second impression task to gather instant feedback from real testers.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => { setModalInitialValues(null); setIsModalOpen(true) }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2955E3] hover:bg-[#1D4ED8] text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" /> Create New Listing
              </button>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-50/70">
                <th className="py-3 px-4 text-left font-bold uppercase tracking-wider">Campaign Title</th>
                <th className="py-3 px-4 text-left font-bold uppercase tracking-wider">Slots Claimed</th>
                <th className="py-3 px-4 text-right font-bold uppercase tracking-wider">Rate per Tester</th>
                <th className="py-3 px-4 text-right font-bold uppercase tracking-wider">Total Budget</th>
                <th className="py-3 px-4 text-center font-bold uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 text-right font-bold uppercase tracking-wider">Created Date</th>
                <th className="py-3 px-4 text-right font-bold uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {data.map(listing => (
                <tr key={listing.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="py-3.5 px-4 text-left font-semibold text-slate-900 max-w-xs truncate">
                    <Link 
                      href={`/dashboard/poster/listings/${listing.id}`} 
                      className="hover:text-[#2955E3] transition-colors font-medium inline-flex items-center gap-1.5"
                    >
                      {listing.title}
                    </Link>
                  </td>
                  <td className="py-3.5 px-4 text-left text-slate-600 font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{listing.slots_filled} / {listing.slots_count}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-slate-900 font-mono text-xs">₱{listing.rate_per_tester}</td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-mono text-xs">₱{listing.total_budget.toLocaleString()}</td>
                  <td className="py-3.5 px-4 text-center">{getStatusBadge(listing.status)}</td>
                  <td className="py-3.5 px-4 text-right text-slate-500 font-mono text-xs">{formatDate(listing.created_at)}</td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button 
                        type="button" 
                        onClick={() => handleDuplicateListing(listing)} 
                        title="Duplicate" 
                        className="p-1.5 text-slate-400 hover:text-[#2955E3] hover:bg-blue-50 rounded-md transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleDownloadReceipt(listing)} 
                        title="Download Spend Receipt" 
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  const pageTitle = activeTab === 'settings' 
    ? 'Poster Settings' 
    : activeTab === 'listings' 
      ? 'All Campaigns' 
      : 'Poster Workspace'

  const pageDesc = activeTab === 'settings' 
    ? 'Manage sandbox credentials, PayMongo keys, and GCash payout configuration.' 
    : activeTab === 'listings' 
      ? 'Manage and filter your full list of testing campaigns.' 
      : `Welcome back, ${profile?.full_name || 'Poster'}. Ready to review your testing pipeline today?`

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{pageTitle}</h1>
          <p className="text-slate-500 text-sm mt-1">{pageDesc}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Primary Action Button */}
          <button 
            type="button"
            onClick={() => { setModalInitialValues(null); setIsModalOpen(true) }} 
            className="bg-[#2955E3] hover:bg-[#1D4ED8] text-white font-semibold px-4 py-2 rounded-lg text-sm shadow-sm transition-all flex items-center gap-1.5 shrink-0 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Listing</span>
          </button>
        </div>
      </div>

      {/* Settings Tab (2-Column SaaS Layout) */}
      {activeTab === 'settings' && (
        <div className="max-w-4xl space-y-8">
          <form onSubmit={handleSaveSettings} className="space-y-8">
            {settingsSuccess && (
              <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm px-4 py-3 rounded-xl shadow-xs animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">{settingsSuccess}</span>
              </div>
            )}
            {settingsError && (
              <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm px-4 py-3 rounded-xl shadow-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-medium">{settingsError}</span>
              </div>
            )}

            {/* Section 1: Sandbox Simulation Mode */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="md:col-span-1 space-y-1">
                <h3 className="text-base font-bold text-slate-900">Sandbox Simulation Mode</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Simulate GCash and PayMongo transactions and payouts safely without charging real funding sources.
                </p>
              </div>
              <div className="md:col-span-2">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">Simulation Status</span>
                      {paymentSettings.sandbox_mode ? (
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Simulation Active
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5 inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Live Billing
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {paymentSettings.sandbox_mode 
                        ? 'Test creation and tester payouts are currently simulated.' 
                        : 'Live transactions enabled. Real balances will be charged.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={paymentSettings.sandbox_mode}
                    onClick={() => setPaymentSettings(prev => ({ ...prev, sandbox_mode: !prev.sandbox_mode }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#2955E3] focus:ring-offset-2 ${
                      paymentSettings.sandbox_mode ? 'bg-[#2955E3]' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        paymentSettings.sandbox_mode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Section 2: PayMongo API Credentials */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-1">
                <h3 className="text-base font-bold text-slate-900">PayMongo API Credentials</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  API keys used for payment link generation, escrow funding, and webhook verification.
                </p>
                <div className="pt-2">
                  <a 
                    href="https://dashboard.paymongo.com" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs text-[#2955E3] hover:text-[#1D4ED8] inline-flex items-center gap-1 font-semibold hover:underline"
                  >
                    PayMongo Dashboard <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Public Key</label>
                      {copiedKey === 'pub' && (
                        <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 animate-in fade-in duration-150">
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied to clipboard
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={paymentSettings.paymongo_public_key} 
                        onChange={e => setPaymentSettings(prev => ({ ...prev, paymongo_public_key: e.target.value }))} 
                        placeholder="pk_test_..." 
                        className="w-full pl-3.5 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2955E3] focus:border-transparent font-mono text-slate-900 bg-slate-50/50" 
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(paymentSettings.paymongo_public_key, 'pub')}
                        title="Copy Public Key"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                      >
                        {copiedKey === 'pub' ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Secret Key</label>
                      {copiedKey === 'sec' && (
                        <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 animate-in fade-in duration-150">
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied to clipboard
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input 
                        type={showSecretKey ? 'text' : 'password'} 
                        value={paymentSettings.paymongo_secret_key} 
                        onChange={e => setPaymentSettings(prev => ({ ...prev, paymongo_secret_key: e.target.value }))} 
                        placeholder="sk_test_..." 
                        className="w-full pl-3.5 pr-20 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2955E3] focus:border-transparent font-mono text-slate-900 bg-slate-50/50" 
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowSecretKey(prev => !prev)}
                          title={showSecretKey ? "Hide secret key" : "Show secret key"}
                          className="text-slate-400 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                        >
                          {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(paymentSettings.paymongo_secret_key, 'sec')}
                          title="Copy Secret Key"
                          className="text-slate-400 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                        >
                          {copiedKey === 'sec' ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Section 3: Payout Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-1">
                <h3 className="text-base font-bold text-slate-900">Payout Configuration</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Designated receiving account for unallocated escrow returns, listing refunds, and account reconciliation.
                </p>
              </div>
              <div className="md:col-span-2">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        GCash Mobile Number
                      </label>
                      {copiedKey === 'gcash' && (
                        <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 animate-in fade-in duration-150">
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied to clipboard
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-500 select-none">
                        +63
                      </span>
                      <input 
                        type="text" 
                        value={paymentSettings.gcash_payout_number} 
                        onChange={e => setPaymentSettings(prev => ({ ...prev, gcash_payout_number: e.target.value }))} 
                        placeholder="9171234567" 
                        className="w-full pl-16 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2955E3] focus:border-transparent font-mono text-slate-900 bg-slate-50/50" 
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(paymentSettings.gcash_payout_number, 'gcash')}
                        title="Copy GCash Number"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                      >
                        {copiedKey === 'gcash' ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Enter your 10-digit Philippine mobile number (e.g. 9171234567).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Section 4: Linked Funding Credentials */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-1">
                <h3 className="text-base font-bold text-slate-900">Linked Funding Credentials</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Link a card for campaign escrow deposits. All transactions are protected under security vaults.
                </p>
              </div>
              <div className="md:col-span-2">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-6">
                  {/* Card Display */}
                  <div className="flex justify-center py-2">
                    <Cards
                      number={cardState.number}
                      name={cardState.name}
                      expiry={cardState.expiry}
                      cvc={cardState.cvc}
                      focused={cardState.focus}
                    />
                  </div>

                  {/* Interactive Card Inputs */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                        Card Number
                      </label>
                      <input
                        type="text"
                        name="number"
                        maxLength={19}
                        placeholder="Card Number"
                        value={cardState.number}
                        onChange={handleCardInputChange}
                        onFocus={handleCardInputFocus}
                        className="w-full pl-3.5 pr-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2955E3] focus:border-transparent font-mono text-slate-900 bg-slate-50/50"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        placeholder="Cardholder Name"
                        value={cardState.name}
                        onChange={handleCardInputChange}
                        onFocus={handleCardInputFocus}
                        className="w-full pl-3.5 pr-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2955E3] focus:border-transparent text-slate-900 bg-slate-50/50"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                          Expiration Date
                        </label>
                        <input
                          type="text"
                          name="expiry"
                          maxLength={4}
                          placeholder="MM/YY"
                          value={cardState.expiry}
                          onChange={handleCardInputChange}
                          onFocus={handleCardInputFocus}
                          className="w-full pl-3.5 pr-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2955E3] focus:border-transparent font-mono text-slate-900 bg-slate-50/50"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                          CVC
                        </label>
                        <input
                          type="text"
                          name="cvc"
                          maxLength={4}
                          placeholder="CVC"
                          value={cardState.cvc}
                          onChange={handleCardInputChange}
                          onFocus={handleCardInputFocus}
                          className="w-full pl-3.5 pr-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2955E3] focus:border-transparent font-mono text-slate-900 bg-slate-50/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end pt-4 border-t border-slate-200">
              <button 
                type="submit" 
                disabled={settingsSaving} 
                className="px-6 py-2.5 bg-[#2955E3] hover:bg-[#1D4ED8] text-white font-semibold rounded-lg text-sm shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 active:scale-[0.98]"
              >
                {settingsSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <span>Save Settings</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Listings Tab */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          {/* Controls Bar: Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-xl shadow-xs">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setListingFilter('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  listingFilter === 'all' 
                    ? 'bg-slate-900 text-white' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All ({listings.length})
              </button>
              <button
                type="button"
                onClick={() => setListingFilter('active')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  listingFilter === 'active' 
                    ? 'bg-slate-900 text-white' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Active ({activeCampaignsCount})
              </button>
              <button
                type="button"
                onClick={() => setListingFilter('review')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  listingFilter === 'review' 
                    ? 'bg-slate-900 text-white' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                In Review ({reviewCampaignsCount})
              </button>
              <button
                type="button"
                onClick={() => setListingFilter('released')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  listingFilter === 'released' 
                    ? 'bg-slate-900 text-white' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Completed ({releasedCampaignsCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#2955E3] bg-slate-50/50"
              />
            </div>
          </div>

          {/* Table View */}
          {renderTable(filteredListings)}
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Welcome Back Operational Summary Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Since your last session:
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Operational Status</span>
              </span>
            </div>
            <div className="mt-3 text-xs sm:text-sm text-slate-700 font-medium leading-relaxed font-mono">
              {"Since your last session: 2 active campaigns updated, 3 submissions awaiting review, ₱0 unallocated escrow funds idle."}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200/60 mt-4">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                <span>2 active campaigns updated</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <span>3 submissions awaiting review</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Wallet className="w-4 h-4 text-slate-400 shrink-0" />
                <span>₱0 unallocated escrow funds idle</span>
              </div>
            </div>
          </div>

          {/* 3-Card Metric Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
            {/* Card 1: Escrow Overview Card */}
            <Tilt
              className="perspective-1000"
              perspective={1000}
              glareEnable={true}
              glareMaxOpacity={0.12}
              glareColor="#ffffff"
              glarePosition="all"
              scale={1.02}
            >
              <div 
                style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #172554 100%)' }}
                className="text-white border border-slate-700/80 rounded-xl p-5 shadow-lg min-h-[190px] flex flex-col justify-between relative overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                      ESCROW PROTECTION VAULT
                    </span>
                    <div className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Protected in Escrow
                    </div>
                  </div>
                  {/* Gold Chip */}
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

                <div className="my-3">
                  <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Total Locked Funds</span>
                  <div className="font-mono text-3xl font-extrabold text-white tracking-tight">
                    ₱{totalEscrow.toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/50">
                  <div className="border-r border-slate-700/50 pr-2">
                    <span className="text-[9px] text-slate-400 block font-medium uppercase tracking-wider">Allocated to Active Listings</span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-slate-100 block">
                      ₱{totalEscrow.toLocaleString()}
                    </span>
                  </div>
                  <div className="pl-1">
                    <span className="text-[9px] text-slate-400 block font-medium uppercase tracking-wider">Available / Idle</span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-slate-100 block">
                      ₱{calculateUnallocated().toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </Tilt>

            {/* Card 2: Active Campaigns & Slots Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all hover-lift hover:shadow-md">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Campaigns & Slots</span>
                  </div>
                  <span className="inline-flex items-center text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60 rounded-full px-2.5 py-0.5 shrink-0">
                    {activeCampaignsCount} Active
                  </span>
                </div>

                <div className="my-3">
                  <span className="text-xs text-slate-400 font-medium block mb-1">Testing Slots Claimed</span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-3xl sm:text-4xl font-extrabold text-slate-900">
                      {totalFilledSlots}
                    </span>
                    <span className="text-slate-400 font-mono text-base sm:text-lg font-medium">
                      / {totalCountSlots} slots
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-100 mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="text-slate-500">Slot Utilization Rate</span>
                  <span className="font-bold text-slate-800 font-mono">{slotUtilizationRate}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#2955E3] rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.max(0, slotUtilizationRate))}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Disbursed Testing Payouts Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all hover-lift hover:shadow-md">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Disbursed Testing Payouts</span>
                  </div>
                  <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-full px-2.5 py-0.5 shrink-0">
                    {releasedCampaignsCount} Released
                  </span>
                </div>

                <div className="my-3">
                  <span className="text-xs text-slate-400 font-medium block mb-1">Total Released Payouts</span>
                  <div className="font-mono text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                    ₱{spentPayouts.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-100 mt-2 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Directly credited to tester GCash</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1 font-mono">
                  <Check className="w-3.5 h-3.5" /> Verified
                </span>
              </div>
            </div>
          </div>

          {/* Insights & Discovery Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
            {/* Escrow & Efficiency Insights Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Escrow & Efficiency Insights</span>
                  <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-full px-2.5 py-0.5">
                    Active Insights
                  </span>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-slate-400 font-medium block mb-2">Cumulative Daily Escrow Allocations</span>
                    <div className="h-44">
                      <ErrorBoundary>
                        <AreaChart
                          className="h-full"
                          data={[
                            { date: 'Jul 15', 'Cumulative Escrow': 5000 },
                            { date: 'Jul 20', 'Cumulative Escrow': 8000 },
                            { date: 'Jul 25', 'Cumulative Escrow': 12000 },
                            { date: 'Jul 30', 'Cumulative Escrow': 18000 },
                            { date: 'Aug 04', 'Cumulative Escrow': 22000 },
                            { date: 'Aug 09', 'Cumulative Escrow': 28000 },
                            { date: 'Aug 15', 'Cumulative Escrow': 35000 }
                          ]}
                          index="date"
                          categories={['Cumulative Escrow']}
                          colors={['blue']}
                          valueFormatter={(number) => `₱${number.toLocaleString('en-PH')}`}
                          showLegend={false}
                          yAxisWidth={60}
                        />
                      </ErrorBoundary>
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Average Reviewer Response Speed</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>14m avg speed</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Feature Discovery Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Product Feature Discovery</span>
                  <span className="inline-flex items-center text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200/60 rounded-full px-2.5 py-0.5">
                    New Feature
                  </span>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    {activeCampaignsCount > 1 ? 'A/B Variants Testing' : 'Benchmarking'}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-mono">
                    {activeCampaignsCount > 1
                      ? 'Optimize your testing pipeline by creating variant questionnaires to cross-verify UX feedback accuracy.'
                      : 'Compare your task completion rates directly against industry benchmarks. Enable usability metrics under listings settings.'}
                  </p>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <Link
                  href="/dashboard/poster?tab=settings"
                  className="text-xs font-bold text-[#2955E3] hover:text-[#1D4ED8] inline-flex items-center gap-1 transition-colors"
                >
                  <span>Explore Advanced Tools</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Campaigns Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">Recent Campaigns</h2>
              {listings.length > 3 && (
                <Link 
                  href="/dashboard/poster?tab=listings" 
                  className="text-sm font-semibold text-[#2955E3] hover:text-[#1D4ED8] transition-colors"
                >
                  View all {listings.length} campaigns &rarr;
                </Link>
              )}
            </div>
            {renderTable(listings.slice(0, 10))}
            {listings.length > 10 && (
              <div className="text-center pt-2">
                <Link 
                  href="/dashboard/poster?tab=listings" 
                  className="text-sm font-semibold text-[#2955E3] hover:text-[#1D4ED8] transition-colors"
                >
                  View all {listings.length} campaigns &rarr;
                </Link>
              </div>
            )}
          </div>

          {/* Campaign Milestones Timeline Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Campaign Milestones Timeline
              </h3>
              <span className="text-xs text-slate-500 font-medium font-mono">Platform Events Tracker</span>
            </div>
            <div className="timeline-container w-full" style={{ minHeight: '350px' }}>
              <ErrorBoundary>
                <Chrono
                  items={[
                    {
                      title: "Jul 15, 2026",
                      cardTitle: "Listing Created",
                      cardSubtitle: "UX evaluation task defined",
                      cardDetailedText: "Initial listing created with a rate of ₱150 per tester to gather feedback on the design prototype."
                    },
                    {
                      title: "Jul 16, 2026",
                      cardTitle: "Escrow Protected",
                      cardSubtitle: "Funds locked securely",
                      cardDetailedText: "Escrow budget successfully funded and secured in the vault to guarantee tester payout."
                    },
                    {
                      title: "Jul 20, 2026",
                      cardTitle: "Testers Claimed",
                      cardSubtitle: "Task slots fully allocated",
                      cardDetailedText: "Verified testers claimed all slots and started functional walkthroughs and impression checks."
                    },
                    {
                      title: "Aug 15, 2026",
                      cardTitle: "Payouts Approved",
                      cardSubtitle: "Escrow released to testers",
                      cardDetailedText: "All completed submissions were approved and payout was disbursed directly to tester GCash wallets."
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
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <CreateCampaignModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          user={user}
          supabase={supabase}
          onSubmitSuccess={() => fetchUserAndListings()}
          initialValues={modalInitialValues}
        />
      )}
    </div>
  )
}

export default function PosterDashboard() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading workspace...</div>}>
      <PosterDashboardContent />
    </Suspense>
  )
}
