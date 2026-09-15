'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ShieldAlert, X, AlertCircle, CheckCircle2, Scale } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { modalBackdropVariants, modalContentVariants } from '@/lib/utils/motion'
import { DISPUTE_REASON_LABELS } from '@/lib/utils/workspace-status'

interface DisputeModalProps {
  isOpen: boolean
  onClose: () => void
  submissionId: string
  listingTitle?: string
  onSubmitDispute: (reason: string, explanation: string) => Promise<void> | void
}

export function DisputeModal({
  isOpen,
  onClose,
  submissionId,
  listingTitle,
  onSubmitDispute
}: DisputeModalProps) {
  const [disputeReason, setDisputeReason] = useState('followed_instructions')
  const [disputeExplanation, setDisputeExplanation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="dispute-modal-backdrop"
          variants={modalBackdropVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dispute-modal-title"
          className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div 
            key="dispute-modal-card"
            variants={modalContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="bg-white rounded-[16px] w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-rose-100 bg-rose-50/60 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200">
                  <ShieldAlert className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="dispute-modal-title" className="font-extrabold text-lg text-gray-900">
                    Request a Second Review
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {listingTitle ? `For "${listingTitle}"` : 'Ask our team to review your rejected submission.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close review request modal"
                className="p-1 text-gray-400 hover:text-gray-600 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {success ? (
                <div className="text-center py-6 space-y-3" role="status" aria-live="polite">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-200">
                    <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-base">Request Submitted!</h4>
                  <p className="text-xs text-gray-500 max-w-xs mx-auto">
                    Your review request has been received. Our team will look at your submission and update you shortly.
                  </p>
                </div>
              ) : (
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (disputeExplanation.trim().length < 10) {
                      setError('Dispute explanation must be at least 10 characters long.')
                      return
                    }

                    setSubmitting(true)
                    setError(null)

                    try {
                      await onSubmitDispute(disputeReason, disputeExplanation.trim())
                      setSuccess(true)
                      setTimeout(() => {
                        setSuccess(false)
                        setDisputeExplanation('')
                        onClose()
                      }, 1200)
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : 'Failed to submit dispute.')
                    } finally {
                      setSubmitting(false)
                    }
                  }} 
                  className="space-y-4"
                >
                  <div className="bg-amber-50 border border-amber-200 rounded-[8px] p-3 text-xs text-amber-900 leading-relaxed">
                    <span className="font-bold flex items-center gap-1 mb-1">
                      <Scale className="w-3.5 h-3.5 text-amber-700 inline" aria-hidden="true" /> Fair Review Policy
                    </span>
                    Our support team will carefully review your submitted recordings, screenshots, and task answers to ensure a fair decision.
                  </div>

                  <div>
                    <label htmlFor="dispute-reason-select" className="block text-xs font-bold text-gray-700 mb-1.5">
                      Reason for review request
                    </label>
                    <select
                      id="dispute-reason-select"
                      value={disputeReason}
                      onChange={e => setDisputeReason(e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-[8px] bg-white text-xs font-medium focus:outline-none focus:border-rose-500 focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      {Object.entries(DISPUTE_REASON_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="dispute-explanation-textarea" className="block text-xs font-bold text-gray-700 mb-1.5">
                      Please describe what happened during your test
                    </label>
                    <textarea
                      id="dispute-explanation-textarea"
                      required
                      value={disputeExplanation}
                      onChange={e => setDisputeExplanation(e.target.value)}
                      placeholder="Explain why your test should be approved and mention what evidence you provided..."
                      rows={4}
                      className="w-full p-3 border border-gray-200 rounded-[8px] text-xs focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus-visible:ring-2 focus-visible:ring-rose-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>Character count: {disputeExplanation.length} / 10 required</span>
                      {disputeExplanation.length > 0 && disputeExplanation.length < 10 && (
                        <span className="text-rose-600 font-semibold">Under 10 characters</span>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-[8px] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 border border-gray-200 text-gray-700 rounded-[8px] hover:bg-gray-100 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={disputeExplanation.trim().length < 10 || submitting}
                      className={`px-5 py-2 text-white rounded-[8px] text-xs font-extrabold shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 ${
                        disputeExplanation.trim().length >= 10 && !submitting
                          ? 'bg-rose-600 hover:bg-rose-700'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {submitting ? 'Sending Request...' : 'Send Request'}
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
  )
}
