'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { 
  Scale, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  Video, 
  AlertCircle, 
  Clock, 
  RefreshCw,
  User,
  DollarSign
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { modalBackdropVariants, modalContentVariants } from '@/lib/utils/motion'

interface DisputedSubmission {
  id: string
  listing_id: string
  tester_id: string
  status: string
  dispute_status?: string
  dispute_notes?: string
  rejection_reason?: string
  rejection_notes?: string
  recording_url?: string
  dispute_resolution_notes?: string
  dispute_resolved_at?: string
  created_at: string
  listings?: {
    id: string
    title: string
    rate_per_tester: number
    poster_id: string
    site_url?: string
  }
  profiles?: {
    id: string
    full_name: string
    role: string
  }
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<DisputedSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Selected dispute for modal adjudication
  const [activeDispute, setActiveDispute] = useState<DisputedSubmission | null>(null)
  const [decision, setDecision] = useState<'overrule_payout' | 'uphold_rejection'>('overrule_payout')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const fetchDisputes = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/disputes')
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load disputes queue')
      }
      setDisputes(data.disputes || [])
    } catch (err: any) {
      setError(err.message || 'An error occurred fetching disputes')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDisputes()
  }, [fetchDisputes])

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeDispute) return

    setIsSubmitting(true)
    setError(null)
    setActionSuccess(null)

    try {
      const res = await fetch('/api/admin/disputes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submission_id: activeDispute.id,
          decision,
          notes: resolutionNotes,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resolve dispute')
      }

      setActionSuccess(
        decision === 'overrule_payout'
          ? 'Dispute resolved: Poster overruled and payout released to tester.'
          : 'Dispute resolved: Poster rejection upheld.'
      )
      setActiveDispute(null)
      setResolutionNotes('')
      fetchDisputes()
    } catch (err: any) {
      setError(err.message || 'Failed to submit dispute resolution')
    } finally {
      setIsSubmitting(false)
    }
  }

  const pendingDisputes = disputes.filter(
    (d) => !d.dispute_resolved_at && d.dispute_status !== 'resolved_approved' && d.dispute_status !== 'resolved_rejected'
  )
  const resolvedDisputes = disputes.filter(
    (d) => d.dispute_resolved_at || d.dispute_status === 'resolved_approved' || d.dispute_status === 'resolved_rejected'
  )

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="h-6 w-6 text-[#2955E3]" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-poppins">
              Dispute Moderation Center
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Review contested tester rejections, evaluate recorded evidence, and arbitrate escrow releases.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchDisputes}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {/* Success banner */}
      {actionSuccess && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm font-medium text-emerald-900">{actionSuccess}</div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-sm font-medium text-rose-900">{error}</div>
        </div>
      )}

      {/* Pending Queue Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>Pending Disputes</span>
            <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-amber-100 text-amber-800 border border-amber-200">
              {pendingDisputes.length}
            </span>
          </h2>
        </div>

        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 text-sm animate-pulse">
            Loading disputes queue…
          </div>
        ) : pendingDisputes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">All disputes resolved</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              There are no pending dispute tickets requiring platform arbitration at this time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pendingDisputes.map((sub) => {
              const rate = sub.listings?.rate_per_tester || 50
              return (
                <div
                  key={sub.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-wider rounded bg-rose-50 text-rose-700 border border-rose-200">
                          Disputed Rejection
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          ID: {sub.id.substring(0, 8)}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">
                        {sub.listings?.title || 'Unknown Test Round'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          Tester: <strong>{sub.profiles?.full_name || sub.tester_id.substring(0, 8)}</strong>
                        </span>
                        <span className="flex items-center gap-1 font-mono font-semibold text-slate-900">
                          <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                          Escrow Stake: ₱{rate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Submitted: {new Date(sub.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveDispute(sub)
                        setDecision('overrule_payout')
                        setResolutionNotes('')
                      }}
                      className="px-4 py-2 bg-[#2955E3] hover:bg-[#1E44C4] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors shrink-0"
                    >
                      Arbitrate Dispute
                    </button>
                  </div>

                  {/* Context comparison grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-200/80 rounded-lg p-4 text-xs">
                    {/* Poster's Rejection */}
                    <div className="space-y-1">
                      <div className="font-semibold text-rose-700 uppercase tracking-wider text-[10px]">
                        Poster Rejection Reason
                      </div>
                      <div className="font-mono text-slate-800">
                        {sub.rejection_reason || 'instructions_not_followed'}
                      </div>
                      <p className="text-slate-600 mt-1 italic">
                        &quot;{sub.rejection_notes || 'No detailed notes provided.'}&quot;
                      </p>
                    </div>

                    {/* Tester's Dispute Statement */}
                    <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4">
                      <div className="font-semibold text-blue-700 uppercase tracking-wider text-[10px]">
                        Tester Contestation Statement
                      </div>
                      <p className="text-slate-800 italic">
                        &quot;{sub.dispute_notes || 'Tester requested administrative review.'}&quot;
                      </p>
                      {sub.recording_url && (
                        <div className="pt-2">
                          <a
                            href={sub.recording_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            <Video className="h-3.5 w-3.5" />
                            View Attached Evidence Recording
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Resolved History Section */}
      {resolvedDisputes.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-slate-200">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>Arbitration History</span>
            <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-slate-100 text-slate-700">
              {resolvedDisputes.length}
            </span>
          </h2>

          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
            {resolvedDisputes.map((sub) => {
              const isOverruled = sub.status === 'approved' || sub.dispute_status === 'resolved_approved'
              return (
                <div key={sub.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {sub.listings?.title || 'Unknown Test Round'}
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      Moderator Note: {sub.dispute_resolution_notes || 'No note recorded.'}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold uppercase tracking-wider border ${
                        isOverruled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {isOverruled ? 'Overruled (Payout Released)' : 'Rejection Upheld'}
                    </span>
                    {sub.dispute_resolved_at && (
                      <span className="text-slate-400 font-mono">
                        {new Date(sub.dispute_resolved_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Arbitration Modal */}
      <AnimatePresence>
        {activeDispute && (
          <motion.div 
            key="admin-arbitrate-backdrop"
            variants={modalBackdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              key="admin-arbitrate-card"
              variants={modalContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-6 border border-slate-200"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Arbitrate Dispute</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Submission ID: <span className="font-mono">{activeDispute.id}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDispute(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleResolve} className="space-y-4">
                {/* Decision Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Select Resolution Verdict
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDecision('overrule_payout')}
                      className={`p-3 rounded-lg border text-left text-xs transition-all ${
                        decision === 'overrule_payout'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        Overrule Poster
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Disburse ₱{activeDispute.listings?.rate_per_tester || 50} to tester&apos;s GCash.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDecision('uphold_rejection')}
                      className={`p-3 rounded-lg border text-left text-xs transition-all ${
                        decision === 'uphold_rejection'
                          ? 'border-rose-600 bg-rose-50 text-rose-900 font-semibold ring-2 ring-rose-500/20'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                        Uphold Rejection
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Finalize rejection and return escrow to poster.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Resolution Explanation */}
                <div className="space-y-1.5">
                  <label htmlFor="resolution-notes" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Resolution Explanation Notes
                  </label>
                  <textarea
                    id="resolution-notes"
                    rows={3}
                    required
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Explain why the evidence satisfies or fails the task requirements..."
                    className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2955E3] text-slate-900"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveDispute(null)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !resolutionNotes.trim()}
                    className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors shadow-sm ${
                      decision === 'overrule_payout'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    } disabled:opacity-50`}
                  >
                    {isSubmitting ? 'Submitting Verdict…' : 'Submit Binding Verdict'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
