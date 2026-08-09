'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { 
  Plus, Wallet, Users, ArrowLeft, AlertCircle, FileText, Check, Copy, Download, Briefcase 
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { sanitizeDatabaseError } from '@/lib/utils/error'
import CreateCampaignModal from '@/components/poster/CreateCampaignModal'

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

  const [paymentSettings, setPaymentSettings] = useState({
    sandbox_mode: true,
    paymongo_public_key: '',
    paymongo_secret_key: '',
    gcash_payout_number: ''
  })
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)

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
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to update payment settings.')
    } finally {
      setSettingsSaving(false)
    }
  }

  const calculateEscrowFunds = () => listings.filter(l => l.status !== 'released' && l.status !== 'expired').reduce((sum, l) => sum + l.total_budget, 0)
  const calculateUnallocated = () => 0 // Mock calculation, logic depends on actual unallocated funds
  const totalEscrow = calculateEscrowFunds()

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-100 rounded-[8px] px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>Open / Funding</span>
      case 'filling':
        return <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-100 rounded-[8px] px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Active (Filling)</span>
      case 'review':
        return <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-100 rounded-[8px] px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>Under Review</span>
      case 'released':
        return <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-100 rounded-[8px] px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Released</span>
      case 'rejected':
        return <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-100 rounded-[8px] px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Rejected</span>
      case 'expired':
        return <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-100 rounded-[8px] px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Expired</span>
      default:
        return <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-100 rounded-[8px] px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>{status || 'Unknown'}</span>
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
      <div className="min-h-screen bg-[#fcfcfc] text-[#1a1a1a] flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 font-medium text-sm animate-pulse">Loading Poster Workspace...</p>
        </div>
      </div>
    )
  }

  if (loadingError) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] text-[#1a1a1a] flex items-center justify-center p-8">
        <div className="bg-white border border-rose-200 rounded-[12px] p-6 max-w-md w-full shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900">Failed to Load Workspace</h3>
            <p className="text-sm text-gray-500 mt-1">{loadingError}</p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => fetchUserAndListings()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-[8px] transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderTable = (data: Listing[]) => (
    <div className="bg-white border border-slate-200 rounded-[12px] overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        {data.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto animate-pulse" />
            <p className="font-semibold text-sm">No campaigns found</p>
            <p className="text-xs text-slate-400">Click &quot;Create New Listing&quot; to launch your first testing round.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-50">
                <th className="py-3 px-4">Campaign Title</th>
                <th className="py-3 px-4">Slots claimed</th>
                <th className="py-3 px-4">Rate per Tester</th>
                <th className="py-3 px-4">Total budget</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {data.map(listing => (
                <tr key={listing.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs truncate">
                    <Link href={`/dashboard/poster/listings/${listing.id}`} className="hover:text-blue-600 transition-colors font-medium flex items-center gap-1.5">
                      {listing.title}
                    </Link>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{listing.slots_filled} / {listing.slots_count}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 font-mono">₱{listing.rate_per_tester}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">₱{listing.total_budget.toLocaleString()}</td>
                  <td className="py-3.5 px-4">{getStatusBadge(listing.status)}</td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono">{formatDate(listing.created_at)}</td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => handleDuplicateListing(listing)} title="Duplicate" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-[8px]">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDownloadReceipt(listing)} title="Download" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-[8px]">
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
    ? 'Manage sandbox credentials and mock payout options.' 
    : activeTab === 'listings' 
      ? 'Manage and filter your full list of testing campaigns.' 
      : `Welcome back, ${profile?.full_name || 'Poster'} 👋 Ready to review some tests today?`

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#1a1a1a] p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 text-sm font-medium mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{pageTitle}</h1>
          <p className="text-slate-500 text-sm mt-1">{pageDesc}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/poster?tab=overview" className={`px-4 py-2 text-sm font-semibold rounded-[8px] transition-colors ${activeTab === 'overview' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>Overview</Link>
          <Link href="/dashboard/poster?tab=listings" className={`px-4 py-2 text-sm font-semibold rounded-[8px] transition-colors ${activeTab === 'listings' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>Listings</Link>
          <Link href="/dashboard/poster?tab=settings" className={`px-4 py-2 text-sm font-semibold rounded-[8px] transition-colors ${activeTab === 'settings' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>Settings</Link>
        </div>
      </div>

      {activeTab === 'settings' && (
        <div className="bg-white border border-slate-200 rounded-[12px] p-6 max-w-2xl shadow-sm">
          <form onSubmit={handleSaveSettings} className="space-y-6">
            {settingsSuccess && (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3 py-2 rounded-[8px]">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{settingsSuccess}</span>
              </div>
            )}
            {settingsError && (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-[8px]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{settingsError}</span>
              </div>
            )}

            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <label className="text-sm font-bold text-slate-900 block">Sandbox Mode</label>
                <span className="text-xs text-slate-500">Enable GCash/PayMongo mock simulations.</span>
              </div>
              <button
                type="button"
                onClick={() => setPaymentSettings(prev => ({ ...prev, sandbox_mode: !prev.sandbox_mode }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${paymentSettings.sandbox_mode ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${paymentSettings.sandbox_mode ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">PayMongo Sandbox Keys</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Public Key</label>
                  <input type="text" value={paymentSettings.paymongo_public_key} onChange={e => setPaymentSettings(prev => ({ ...prev, paymongo_public_key: e.target.value }))} placeholder="pk_test_..." className="w-full px-3 py-2 border border-slate-200 rounded-[8px] text-sm focus:outline-none focus:border-blue-500 font-mono" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Secret Key</label>
                  <input type="password" value={paymentSettings.paymongo_secret_key} onChange={e => setPaymentSettings(prev => ({ ...prev, paymongo_secret_key: e.target.value }))} placeholder="sk_test_..." className="w-full px-3 py-2 border border-slate-200 rounded-[8px] text-sm focus:outline-none focus:border-blue-500 font-mono" />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Payout Configuration</h3>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">GCash Payout Number</label>
                <input type="text" value={paymentSettings.gcash_payout_number} onChange={e => setPaymentSettings(prev => ({ ...prev, gcash_payout_number: e.target.value }))} placeholder="e.g. 09171234567" className="w-full px-3 py-2 border border-slate-200 rounded-[8px] text-sm focus:outline-none focus:border-blue-500 font-mono" />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button type="submit" disabled={settingsSaving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-[8px] text-sm transition-colors disabled:opacity-50">
                {settingsSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'listings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">All Campaigns</h2>
            <button onClick={() => { setModalInitialValues(null); setIsModalOpen(true) }} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-[8px] text-sm font-bold shadow-sm transition-colors flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Create New Listing
            </button>
          </div>
          {renderTable(listings)}
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#0F172A] border border-slate-800 rounded-[12px] p-6 flex flex-col justify-between min-h-[220px]">
              <div>
                <h3 className="text-sm text-slate-400 font-bold uppercase tracking-wider">Escrow Summary</h3>
                <div className="mt-4 mb-8">
                  <span className="text-xs text-slate-400 block mb-1">Total Locked Funds</span>
                  <span className="font-mono text-4xl font-extrabold text-white">₱{totalEscrow.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-400 block">Allocated to Active Listings</span>
                    <span className="font-mono text-lg font-bold text-slate-200">₱{totalEscrow.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Unallocated / Idle</span>
                    <span className="font-mono text-lg font-bold text-slate-200">₱{calculateUnallocated().toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
                <button onClick={() => { setModalInitialValues(null); setIsModalOpen(true) }} className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 rounded-[8px] text-sm font-bold shadow-sm transition-colors flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Create New Listing
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
              <div className="bg-white border border-slate-200 rounded-[12px] p-4 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Listings</span>
                  <Briefcase className="w-4 h-4 text-blue-500" />
                </div>
                <div className="mt-2">
                  <span className="font-mono text-2xl font-bold text-slate-900">{listings.filter(l => l.status !== 'released' && l.status !== 'expired').length}</span>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-[12px] p-4 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Slots</span>
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <div className="mt-2">
                  <span className="font-mono text-2xl font-bold text-slate-900">{listings.reduce((sum, l) => sum + l.slots_filled, 0)} / {listings.reduce((sum, l) => sum + l.slots_count, 0)}</span>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-[12px] p-4 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Spent Payouts</span>
                  <Wallet className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-2">
                  <span className="font-mono text-2xl font-bold text-slate-900">₱{listings.filter(l => l.status === 'released').reduce((sum, l) => sum + l.total_budget, 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">Recent Campaigns</h2>
            {renderTable(listings.slice(0, 3))}
            {listings.length > 3 && (
              <div className="text-center mt-4">
                <Link href="/dashboard/poster?tab=listings" className="text-sm font-semibold text-blue-600 hover:text-blue-700">View all {listings.length} campaigns &rarr;</Link>
              </div>
            )}
          </div>
        </div>
      )}

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
