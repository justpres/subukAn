'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { modalBackdropVariants, modalContentVariants } from '@/lib/utils/motion'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  User,
  Smartphone,
  Monitor,
  Video,
  Image as ImageIcon,
  Loader2,
  Star,
  ExternalLink,
  Check,
  ShieldAlert,
  AlertTriangle,
  Paperclip,
  X,
  Search,
  ClipboardList
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { DynamicWatermark } from '@/components/shared/DynamicWatermark'
import { sanitizeDatabaseError } from '@/lib/utils/error'

// Interfaces mapping to Supabase Tables schema
interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  device_type: 'mobile' | 'desktop' | 'both' | null;
  tech_comfort_level: 'student_dev' | 'casual_user' | 'non_technical' | null;
  phone_verified: boolean;
}

interface Listing {
  id: string;
  title: string;
  description: string;
  rate_per_tester: number;
  slots_count: number;
  total_budget: number;
  review_window_minutes: number;
  status: string;
  poster_id: string;
  variants?: any[];
}

interface Submission {
  id: string;
  listing_id: string;
  tester_id: string;
  status: 'in_progress' | 'pending_review' | 'approved' | 'rejected' | 'expired';
  started_at: string;
  submitted_at: string | null;
  auto_release_at: string | null;
  review_completed_at: string | null;
  rejection_reason: 'instructions_not_followed' | 'recording_mismatch' | 'incomplete' | 'low_effort' | null;
  rejection_explanation: string | null;
  assigned_variant_id?: string | null;
}

interface Task {
  id: string;
  listing_id: string;
  order_index: number;
  question_text: string;
  requires_recording: boolean;
  requires_image: boolean;
}

interface TaskResponse {
  id: string;
  submission_id: string;
  task_id: string;
  answer_text: string;
  completed_successfully: boolean;
  time_on_task_seconds: number;
  difficulty_rating: number;
  recording_url: string | null;
  image_url: string | null;
  task?: Task;
}

interface Payout {
  id: string;
  submission_id: string;
  tester_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  processor_payout_id: string | null;
  idempotency_key: string;
  processed_at: string | null;
  created_at: string;
}

interface PageProps {
  params: {
    id: string;
    submissionId: string;
  }
}

export default function SubmissionReviewPage({ params }: PageProps) {
  const { id, submissionId } = params
  const supabase = createBrowserClient()

  // Data states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [listing, setListing] = useState<Listing | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [responses, setResponses] = useState<TaskResponse[]>([])
  const [payout, setPayout] = useState<Payout | null>(null)
  
  // Media URL signing state
  const [signedMediaUrls, setSignedMediaUrls] = useState<Record<string, string>>({})
  
  // Dialog / Interaction states
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState<string>('')
  const [rejectionExplanation, setRejectionExplanation] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  
  const [isApproving, setIsApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  
  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectError, setRejectError] = useState<string | null>(null)
  
  const [rejectionAttachment, setRejectionAttachment] = useState<File | null>(null)
  const [rejectionAttachmentPreview, setRejectionAttachmentPreview] = useState<string | null>(null)
  const [rejectionAttachmentError, setRejectionAttachmentError] = useState<string | null>(null)
  
  // Live Countdown state
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  
  // Lightbox for full screenshot preview
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Post-Test Debrief Threading / Comments
  const [comments, setComments] = useState<any[]>([])
  const [newCommentText, setNewCommentText] = useState('')
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)

  // Initial Data Fetching
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        // 1. Fetch submission details
        const { data: subData, error: subError } = await supabase
          .from('submissions')
          .select('*')
          .eq('id', submissionId)
          .single()

        if (subError || !subData) {
          throw new Error(subError?.message || 'Submission not found or access denied.')
        }
        setSubmission(subData)

        // 2. Fetch associated listing details
        const { data: listData, error: listError } = await supabase
          .from('listings')
          .select('*')
          .eq('id', id)
          .single()

        if (listError || !listData) {
          throw new Error(listError?.message || 'Associated listing not found.')
        }
        setListing(listData)

        // 3. Fetch tester profile details
        const { data: profData, error: profError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', subData.tester_id)
          .single()

        if (profError || !profData) {
          throw new Error(profError?.message || 'Tester profile details could not be retrieved.')
        }
        setProfile(profData)

        // 4. Fetch task responses with questions
        const { data: respData, error: respError } = await supabase
          .from('task_responses')
          .select(`
            *,
            task:tasks (
              id,
              question_text,
              requires_recording,
              requires_image,
              order_index
            )
          `)
          .eq('submission_id', submissionId)

        if (respError) {
          throw new Error(respError.message)
        }

        // Sort responses by order index
        const sorted = respData ? [...respData].sort((a: any, b: any) => {
          const aIndex = a.task?.order_index ?? 0
          const bIndex = b.task?.order_index ?? 0
          return aIndex - bIndex
        }) : []
        setResponses(sorted)

        // 5. Fetch payout details if approved
        if (subData.status === 'approved') {
          const { data: payoutData } = await supabase
            .from('payouts')
            .select('*')
            .eq('submission_id', submissionId)
            .maybeSingle()
          setPayout(payoutData)
        }

        // 6. Fetch debrief comments
        const { data: commData, error: commError } = await supabase
          .from('submission_comments')
          .select(`
            id,
            comment_text,
            created_at,
            user_id,
            profiles (
              full_name,
              role
            )
          `)
          .eq('submission_id', submissionId)
          .order('created_at', { ascending: true })

        if (!commError && commData) {
          setComments(commData)
        }

      } catch (err: any) {
        console.error('Error fetching review data:', err)
        setError(err.message || 'An unexpected error occurred while loading files.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [submissionId, id, supabase])

  const fetchComments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('submission_comments')
        .select(`
          id,
          comment_text,
          created_at,
          user_id,
          profiles (
            full_name,
            role
          )
        `)
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setComments(data || [])
    } catch (err: any) {
      console.error('Failed to fetch comments:', err)
    }
  }, [submissionId, supabase])

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    setCommentError(null)
    if (!newCommentText.trim()) return
    setCommentsLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !session.user) {
        setCommentError('Authentication required. Please log in again.')
        setCommentsLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('submission_comments')
        .insert({
          submission_id: submissionId,
          user_id: session.user.id,
          comment_text: newCommentText.trim()
        })
        .select()
        .single()

      if (error) throw error

      setNewCommentText('')
      await fetchComments()
    } catch (err: unknown) {
      setCommentError(sanitizeDatabaseError(err, 'Failed to post comment. Please try again.'))
    } finally {
      setCommentsLoading(false)
    }
  }

  // Resolve private storage URLs to secure signed URLs on load
  useEffect(() => {
    const resolveUrls = async () => {
      if (!responses || responses.length === 0) return

      const urls: Record<string, string> = {}
      for (const response of responses) {
        // Sign recording video
        if (response.recording_url) {
          if (response.recording_url.startsWith('http://') || response.recording_url.startsWith('https://')) {
            urls[`recording_${response.id}`] = response.recording_url
          } else {
            const bucketName = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'task-attachments'
            const { data, error } = await supabase.storage
              .from(bucketName)
              .createSignedUrl(response.recording_url, 3600) // 1 Hour Link

            if (!error && data?.signedUrl) {
              urls[`recording_${response.id}`] = data.signedUrl
            } else {
              console.error('Failed to create signed URL for video path:', response.recording_url, error)
            }
          }
        }

        // Sign image screenshot
        if (response.image_url) {
          if (response.image_url.startsWith('http://') || response.image_url.startsWith('https://')) {
            urls[`image_${response.id}`] = response.image_url
          } else {
            const bucketName = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'task-attachments'
            const { data, error } = await supabase.storage
              .from(bucketName)
              .createSignedUrl(response.image_url, 3600) // 1 Hour Link

            if (!error && data?.signedUrl) {
              urls[`image_${response.id}`] = data.signedUrl
            } else {
              console.error('Failed to create signed URL for image path:', response.image_url, error)
            }
          }
        }
      }
      setSignedMediaUrls(urls)
    }

    if (responses.length > 0) {
      resolveUrls()
    }
  }, [responses, supabase])

  // Live Auto-Release Countdown Calculation
  useEffect(() => {
    if (!submission?.auto_release_at || submission.status !== 'pending_review') {
      setSecondsLeft(null)
      return
    }

    const calculateSecondsLeft = () => {
      const autoReleaseTime = new Date(submission.auto_release_at!).getTime()
      const now = Date.now()
      const diff = Math.floor((autoReleaseTime - now) / 1000)
      return diff > 0 ? diff : 0
    }

    setSecondsLeft(calculateSecondsLeft())

    const interval = setInterval(() => {
      const left = calculateSecondsLeft()
      setSecondsLeft(left)
      if (left <= 0) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [submission])

  // Approval Flow Trigger (Calls /api/payout)
  const handleApprovePayout = async () => {
    setIsApproving(true)
    setApproveError(null)
    try {
      if (!listing) return

      const response = await fetch('/api/payout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submission_id: submissionId,
          amount: listing.rate_per_tester,
        }),
      })

      const responseData = await response.json()
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to disburse payout via PayMongo/GCash')
      }

      // Locally update submission status and fetch payout record
      setSubmission(prev => prev ? {
        ...prev,
        status: 'approved',
        review_completed_at: new Date().toISOString()
      } : null)

      // Fetch newly generated payout record
      const { data: payoutData } = await supabase
        .from('payouts')
        .select('*')
        .eq('submission_id', submissionId)
        .maybeSingle()
      
      if (payoutData) {
        setPayout(payoutData)
      }

      setShowApproveConfirm(false)
    } catch (err: any) {
      console.error('Disbursement processing error:', err)
      setApproveError(err.message || 'An unexpected error occurred during payment release.')
    } finally {
      setIsApproving(false)
    }
  }

  const handleCloseRejectModal = () => {
    setIsRejectModalOpen(false)
    setRejectionReason('')
    setRejectionExplanation('')
    setRejectionAttachment(null)
    setRejectionAttachmentPreview(null)
    setRejectionAttachmentError(null)
    setRejectError(null)
  }

  // Rejection Flow Trigger (Updates submission status & fields in Supabase)
  const handleRejectSubmission = async () => {
    if (!rejectionReason || !rejectionExplanation) {
      setRejectError('Please select a reason and fill in the required explanation.')
      return
    }

    if (rejectionExplanation.trim().length < 10) {
      setRejectError('Explanation must be at least 10 characters long.')
      return
    }

    if (rejectionExplanation.trim().length > 500) {
      setRejectError('Explanation cannot exceed 500 characters.')
      return
    }

    setIsRejecting(true)
    setRejectError(null)
    try {
      const updateData: any = {
        status: 'rejected',
        rejection_reason: rejectionReason,
        rejection_explanation: rejectionExplanation.trim(),
        review_completed_at: new Date().toISOString()
      }
      
      if (rejectionAttachment) {
        updateData.rejection_attachment = rejectionAttachment.name
      }

      const { error: updateError } = await supabase
        .from('submissions')
        .update(updateData)
        .eq('id', submissionId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      // Locally update submission status
      setSubmission(prev => prev ? {
        ...prev,
        status: 'rejected',
        rejection_reason: rejectionReason as any,
        rejection_explanation: rejectionExplanation.trim(),
        review_completed_at: new Date().toISOString()
      } : null)

      handleCloseRejectModal()
    } catch (err: any) {
      console.error('Rejection submission error:', err)
      setRejectError(err.message || 'Failed to submit rejection status.')
    } finally {
      setIsRejecting(false)
    }
  }

  // Format Helper functions
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5" title={`Difficulty: ${rating}/5`}>
        {Array.from({ length: 5 }).map((_, idx) => (
          <Star
            key={idx}
            className={`w-4 h-4 ${
              idx < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'
            }`}
          />
        ))}
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-[8px] bg-sky-100 text-sky-800 border border-sky-200 uppercase tracking-wider">
            In Progress
          </span>
        )
      case 'pending_review':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-[8px] bg-yellow-100 text-yellow-800 border border-yellow-200 uppercase tracking-wider">
            Pending Review
          </span>
        )
      case 'approved':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-[8px] bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
            Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-[8px] bg-rose-100 text-rose-800 border border-rose-200 uppercase tracking-wider">
            Rejected
          </span>
        )
      case 'expired':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-[8px] bg-gray-100 text-gray-800 border border-gray-200 uppercase tracking-wider">
            Expired
          </span>
        )
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-[8px] bg-gray-100 text-gray-800 border border-gray-200 uppercase">
            {status}
          </span>
        )
    }
  }

  const getRejectionReasonLabel = (reason: string | null) => {
    if (!reason) return ''
    const map: Record<string, string> = {
      instructions_not_followed: 'Instructions not followed',
      recording_mismatch: 'Recording mismatch',
      incomplete: 'Incomplete submission',
      low_effort: 'Low effort / Spam',
    }
    return map[reason] || reason
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-gray-500 font-medium">Retrieving submission details & private recordings...</p>
        </div>
      </div>
    )
  }

  if (error || !submission || !listing || !profile) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] p-8 max-w-4xl mx-auto flex flex-col justify-center">
        <div className="bg-rose-50 border border-rose-200 rounded-[12px] p-6 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-rose-600 mx-auto" />
          <h3 className="text-lg font-bold text-gray-900">Unable to load submission</h3>
          <p className="text-rose-700 text-sm">{error || 'The requested resource could not be found.'}</p>
          <div className="pt-2">
            <Link
              href={`/dashboard/poster/listings/${id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-[8px] text-sm font-semibold hover:bg-gray-50 text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Listing
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#1a1a1a] p-8 max-w-6xl mx-auto">
      {/* Back link */}
      <Link href={`/dashboard/poster/listings/${id}`} className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-900 mb-6 text-sm font-medium transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Listing
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between border-b border-gray-200 pb-6 mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-8 h-8 text-gray-700" />
            <h1 className="text-3xl font-extrabold tracking-tight">Review Tester Submission</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Round: <span className="font-bold text-gray-800">{listing.title}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Listing ID: <span className="font-mono">{listing.id}</span> | Submission ID: <span className="font-mono">{submission.id}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="text-right">
            <span className="text-xs text-gray-500 block">GCash Rate Per Slot</span>
            <span className="text-2xl font-black text-blue-600">₱{listing.rate_per_tester}</span>
          </div>
          {getStatusBadge(submission.status)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content area (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Tester Profile Card */}
          <div className="bg-white border border-gray-200 rounded-[12px] p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-4">
              <User className="w-5 h-5 text-gray-400" />
              <h2 className="font-bold text-lg text-gray-900">Tester Demographics</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-gray-400 block font-semibold uppercase tracking-wider">Tester Identity</span>
                  <span className="font-bold text-gray-800 text-base font-mono">Tester #{profile.id.slice(0, 8)}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-semibold uppercase tracking-wider">Verification status</span>
                  {profile.phone_verified ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-[6px] border border-emerald-100 font-semibold mt-1">
                      <Check className="w-3.5 h-3.5" /> GCash Verified Phone Number
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 px-2 py-1 rounded-[6px] border border-rose-100 font-semibold mt-1">
                      <X className="w-3.5 h-3.5" /> Phone Unverified
                    </span>
                  )}
                </div>
                {listing.variants && Array.isArray(listing.variants) && listing.variants.length > 0 && submission.assigned_variant_id && (
                  <div>
                    <span className="text-xs text-gray-400 block font-semibold uppercase tracking-wider">A/B Testing Variant</span>
                    {(() => {
                      const variant = listing.variants.find((v: any) => v.id === submission.assigned_variant_id);
                      return (
                        <span className="inline-flex items-center gap-1.5 text-xs text-purple-700 bg-purple-50 px-2 py-1 rounded-[6px] border border-purple-100 font-semibold mt-1">
                          {variant ? variant.title : submission.assigned_variant_id}
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-xs text-gray-400 block font-semibold uppercase tracking-wider">Primary Device</span>
                  <span className="font-medium text-gray-800 flex items-center gap-1.5 mt-0.5">
                    {profile.device_type === 'mobile' ? (
                      <><Smartphone className="w-4 h-4 text-blue-500" /> Mobile</>
                    ) : profile.device_type === 'desktop' ? (
                      <><Monitor className="w-4 h-4 text-blue-500" /> Desktop</>
                    ) : (
                      <><Smartphone className="w-4 h-4 text-blue-500" /><Monitor className="w-4 h-4 text-blue-500" /> Both</>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-semibold uppercase tracking-wider">Tech Competence Tier</span>
                  <span className="font-semibold text-gray-700 mt-0.5 block">
                    {profile.tech_comfort_level === 'student_dev' && 'Student Developer'}
                    {profile.tech_comfort_level === 'casual_user' && 'Casual Tech User'}
                    {profile.tech_comfort_level === 'non_technical' && 'Non-Technical User'}
                    {!profile.tech_comfort_level && 'Not Specified'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Task Responses List */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
              <ClipboardList className="w-5 h-5 text-gray-600" /> Step Responses & Evidence ({responses.length})
            </h2>

            {responses.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-[12px] p-8 text-center text-gray-500 text-sm">
                No task responses recorded for this submission.
              </div>
            ) : (
              responses.map((response, index) => (
                <div key={response.id} className="bg-white border border-gray-200 rounded-[12px] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  {/* Step Header */}
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-widest block">Step {index + 1}</span>
                      <h3 className="font-bold text-gray-900 mt-0.5">{response.task?.question_text || 'Testing Task'}</h3>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1 bg-white border px-2.5 py-1 rounded-[6px] text-xs font-medium text-gray-600">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{formatDuration(response.time_on_task_seconds)}</span>
                      </div>
                      <div className="bg-white border px-2.5 py-1 rounded-[6px]">
                        {renderStars(response.difficulty_rating)}
                      </div>
                    </div>
                  </div>

                  {/* Step Body */}
                  <div className="p-6 space-y-6">
                    {/* Answer text */}
                    <div>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Answer / Response</span>
                      <div className="p-4 bg-gray-50 rounded-[8px] text-sm text-gray-800 whitespace-pre-wrap border border-gray-100 leading-relaxed font-sans">
                        {response.answer_text}
                      </div>
                    </div>

                    {/* Success declaration */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-2">Tester Claim:</span>
                      {response.completed_successfully ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 font-semibold px-2 py-0.5 rounded-[6px]">
                          <Check className="w-3.5 h-3.5" /> Declared Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-rose-700 bg-rose-50 border border-rose-100 font-semibold px-2 py-0.5 rounded-[6px]">
                          <X className="w-3.5 h-3.5" /> Declared Failure / Stuck
                        </span>
                      )}
                    </div>

                    {/* Recording Player Attachment */}
                    {response.task?.requires_recording && (
                      <div className="space-y-2 pt-2 border-t border-gray-100">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Required Screen Recording</span>
                        {response.recording_url ? (
                          <div className="bg-[#121212] rounded-xl border border-gray-800 overflow-hidden shadow-md relative">
                            <DynamicWatermark testerId={submission.tester_id} className="opacity-[0.12] dark:opacity-[0.15]" />
                            <div className="bg-gray-900 px-4 py-2 border-b border-gray-800 flex items-center justify-between text-xs text-gray-400 relative z-10">
                              <div className="flex items-center gap-2">
                                <Video className="w-4 h-4 text-blue-500" />
                                <span className="font-mono truncate max-w-xs">{response.recording_url.split('/').pop()}</span>
                              </div>
                              <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-[10px]">Secure Playback</span>
                            </div>
                            
                            {signedMediaUrls[`recording_${response.id}`] ? (
                              <video
                                src={signedMediaUrls[`recording_${response.id}`]}
                                controls
                                className="w-full object-contain max-h-[400px] bg-black"
                                preload="metadata"
                              >
                                Your browser does not support the video tag.
                              </video>
                            ) : (
                              <div className="p-8 text-center text-gray-500 text-sm flex flex-col items-center justify-center gap-2">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                <span>Generating signed video url...</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-[8px] text-xs text-amber-800 flex gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>Missing recording. The tester was instructed to upload a screen recording but failed to attach it.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Image screenshot */}
                    {response.task?.requires_image && (
                      <div className="space-y-2 pt-2 border-t border-gray-100">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Required Screenshot Evidence</span>
                        {response.image_url ? (
                          <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-gray-55 max-w-md">
                            <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center justify-between text-xs text-gray-500">
                              <div className="flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-blue-500" />
                                <span className="truncate max-w-[200px]">{response.image_url.split('/').pop()}</span>
                              </div>
                              <span className="bg-white text-gray-500 px-2 py-0.5 rounded text-[10px] border">PNG/JPEG</span>
                            </div>
                            
                            {signedMediaUrls[`image_${response.id}`] ? (
                              <div
                                className="relative group cursor-pointer overflow-hidden"
                                onClick={() => setLightboxUrl(signedMediaUrls[`image_${response.id}`])}
                              >
                                <DynamicWatermark testerId={submission.tester_id} className="opacity-[0.12]" />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={signedMediaUrls[`image_${response.id}`]}
                                  alt={`Step ${index + 1} screenshot evidence`}
                                  className="w-full object-cover max-h-[220px] hover:opacity-90 transition-opacity"
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="bg-white/95 text-gray-800 text-xs px-3 py-1.5 rounded-lg shadow font-semibold flex items-center gap-1">
                                    <ExternalLink className="w-3.5 h-3.5" /> Click to zoom
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="p-8 text-center text-gray-500 text-sm flex flex-col items-center justify-center gap-2">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                <span>Generating signed image url...</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-[8px] text-xs text-amber-800 flex gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>Missing image evidence. The tester was instructed to upload a screenshot but failed to attach it.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Post-Test Debrief Thread */}
          <div className="bg-white border border-gray-200 rounded-[12px] p-6 shadow-sm flex flex-col h-[500px] mt-8 animate-fadeIn">
            <div className="border-b border-gray-100 pb-4 mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-gray-900">Post-Test Debrief Thread</h3>
                <p className="text-xs text-gray-500">Communicate directly with the tester to ask clarification questions about their testing round.</p>
              </div>
              <button
                type="button"
                onClick={() => fetchComments()}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Refresh
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {comments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 space-y-2">
                  <p className="text-xs font-semibold">No comments in this thread yet.</p>
                  <p className="text-[11px] max-w-xs">Ask the tester to clarify how they encountered a bug, or give them tips on what screenshot you needed.</p>
                </div>
              ) : (
                comments.map((comment) => {
                  const isPosterRole = comment.profiles?.role === 'poster';
                  return (
                    <div
                      key={comment.id}
                      className={`flex flex-col max-w-[85%] rounded-[8px] p-3 text-xs leading-relaxed ${
                        isPosterRole
                          ? 'bg-blue-50 border border-blue-100 ml-auto text-blue-900'
                          : 'bg-purple-50 border border-purple-100 mr-auto text-purple-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold mb-1">
                        <span>{isPosterRole ? (comment.profiles?.full_name || 'You (Poster)') : `Tester #${(comment.user_id || '').slice(0, 8)}`}</span>
                        <span
                          className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] font-extrabold ${
                            isPosterRole ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {isPosterRole ? 'Poster' : 'Tester'}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{comment.comment_text}</p>
                      <span className="text-[9px] text-gray-400 self-end mt-1.5 font-semibold">
                        {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Comment Form */}
            {commentError && (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-[8px] mb-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{commentError}</span>
              </div>
            )}
            <form onSubmit={handlePostComment} className="border-t border-gray-100 pt-4 flex gap-2">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Type your comment/question here..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-[8px] text-xs focus:outline-none focus:border-blue-500 bg-white text-gray-800"
                disabled={commentsLoading}
                required
              />
              <button
                type="submit"
                disabled={commentsLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-[8px] text-xs disabled:opacity-50 transition-all"
              >
                {commentsLoading ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar Panel (Right col) */}
        <div className="space-y-6">
          
          {/* Submission Info Box */}
          <div className="bg-white border border-gray-200 rounded-[12px] p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" /> Audit Log
            </h3>
            
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Started Round:</span>
                <span className="font-medium text-gray-700">{formatDate(submission.started_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Submitted:</span>
                <span className="font-medium text-gray-700">{formatDate(submission.submitted_at)}</span>
              </div>
              {submission.review_completed_at && (
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold text-gray-500">Review Completed:</span>
                  <span className="font-semibold text-gray-700">{formatDate(submission.review_completed_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Auto-Release Indicator */}
          {submission.status === 'pending_review' && secondsLeft !== null && (
            <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle className="w-5 h-5" />
                <span className="font-bold text-sm uppercase tracking-wider">Escrow Auto-Release</span>
              </div>
              
              <div className="text-center py-2 bg-white/70 rounded-lg border border-amber-100">
                <span className="text-xs text-amber-700 font-bold block mb-0.5">Time Remaining</span>
                {secondsLeft > 0 ? (
                  <span className="text-3xl font-mono font-black text-amber-600 tracking-wider">
                    {formatCountdown(secondsLeft)}
                  </span>
                ) : (
                  <span className="text-lg font-bold text-rose-600 uppercase">
                    Auto-Release Elapsed
                  </span>
                )}
              </div>

              <p className="text-xs text-amber-700 leading-relaxed">
                If you fail to either approve or reject this submission within the review window, funds will be auto-released from escrow to the tester.
              </p>
            </div>
          )}

          {/* Review Actions Panel */}
          <div className="bg-white border border-gray-200 rounded-[12px] p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-blue-600" /> Review Outcome
            </h3>

            {submission.status === 'pending_review' && (
              <div className="space-y-3 pt-1">
                {/* Standard buttons layout */}
                {!showApproveConfirm ? (
                  <>
                    <button
                      onClick={() => setShowApproveConfirm(true)}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-[8px] shadow-sm flex items-center justify-center gap-2 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve & Release Payout
                    </button>
                    <button
                      onClick={() => setIsRejectModalOpen(true)}
                      className="w-full py-2.5 border border-rose-200 hover:border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-sm rounded-[8px] flex items-center justify-center gap-2 transition-all"
                    >
                      <XCircle className="w-4 h-4" /> Reject Submission
                    </button>
                  </>
                ) : (
                  <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-[8px] space-y-3">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Confirm Fund Release</span>
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      Are you sure you want to approve this submission? This releases ₱{listing.rate_per_tester} from escrow to the tester&apos;s GCash account. This action is irreversible.
                    </p>
                    
                    {approveError && (
                      <div className="p-2 bg-rose-50 text-rose-800 text-[11px] font-semibold border border-rose-100 rounded">
                        {approveError}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <button
                        onClick={handleApprovePayout}
                        disabled={isApproving}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-[6px] shadow-sm flex items-center justify-center gap-1 disabled:opacity-50 transition-colors"
                      >
                        {isApproving ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>
                        ) : (
                          'Yes, Release Funds'
                        )}
                      </button>
                      <button
                        onClick={() => setShowApproveConfirm(false)}
                        disabled={isApproving}
                        className="py-2 px-3 border border-gray-200 text-gray-700 font-bold text-xs bg-white rounded-[6px] hover:bg-gray-150 disabled:opacity-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {submission.status === 'approved' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-[8px] space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-bold text-sm">Payout Released</span>
                </div>
                
                <p className="text-xs text-emerald-700 leading-relaxed">
                  The round submission has been approved. The payout was disburst out of escrow to the tester&apos;s GCash account.
                </p>

                {payout && (
                  <div className="bg-white/80 p-2.5 rounded border border-emerald-100 text-[11px] font-mono text-emerald-900 space-y-1">
                    <div>
                      <span className="text-emerald-700 font-bold">Payout Status:</span> {payout.status.toUpperCase()}
                    </div>
                    {payout.processor_payout_id && (
                      <div className="truncate">
                        <span className="text-emerald-700 font-bold">Transaction Ref:</span> {payout.processor_payout_id}
                      </div>
                    )}
                    {payout.processed_at && (
                      <div>
                        <span className="text-emerald-700 font-bold">Completed At:</span> {formatDate(payout.processed_at)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {submission.status === 'rejected' && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-[8px] space-y-3">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span className="font-bold text-sm">Submission Rejected</span>
                </div>
                
                <div className="space-y-1.5 text-xs text-rose-700 leading-relaxed">
                  <p>
                    <span className="font-bold block uppercase tracking-wider text-[10px] text-rose-500">Reason</span>
                    <span className="font-semibold text-gray-800">{getRejectionReasonLabel(submission.rejection_reason)}</span>
                  </p>
                  <p>
                    <span className="font-bold block uppercase tracking-wider text-[10px] text-rose-500">Poster explanation</span>
                    <span className="italic block bg-white/70 p-2 rounded border border-rose-100 font-sans mt-0.5 font-medium text-gray-700">
                      &quot;{submission.rejection_explanation}&quot;
                    </span>
                  </p>
                </div>
              </div>
            )}

            {submission.status === 'in_progress' && (
              <div className="p-4 bg-sky-50 border border-sky-200 text-sky-800 rounded-[8px] space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-sky-600 shrink-0" />
                  <span className="font-bold text-sm">Tester Working</span>
                </div>
                <p className="text-xs text-sky-700 leading-relaxed">
                  The tester has checked out this slot but has not submitted the final evidence yet. Payout remains locked in escrow.
                </p>
              </div>
            )}

            {submission.status === 'expired' && (
              <div className="p-4 bg-gray-50 border border-gray-200 text-gray-800 rounded-[8px] space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-gray-500 shrink-0" />
                  <span className="font-bold text-sm">Submission Expired</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  The tester did not finish the tasks within the required timeframe, and the reservation expired.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rejection Modal Dialog */}
      {mounted && createPortal(
        <AnimatePresence>
          {isRejectModalOpen && (
            <motion.div 
              key="reject-modal-backdrop"
              variants={modalBackdropVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            >
              <motion.div 
                key="reject-modal-card"
                variants={modalContentVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="bg-white rounded-lg shadow-xl max-w-lg w-full flex flex-col max-h-[85vh] overflow-hidden"
              >
                {/* Modal Header */}
                <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                  <h4 className="font-extrabold text-lg flex items-center gap-2 text-gray-900">
                    <XCircle className="w-5 h-5 text-rose-600" /> Reject Submission Evidence
                  </h4>
                  <button
                    onClick={handleCloseRejectModal}
                    className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                  >
                    &times;
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-4">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Rejecting this submission will lock out the tester&apos;s claim to payment for this slot. Please select a valid reason and provide a detailed explanation.
                  </p>

                  {rejectError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-rose-800 text-xs font-semibold flex gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{rejectError}</span>
                    </div>
                  )}

                  {/* Rejection Reason Selector */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                      Rejection Category (Mandatory)
                    </label>
                    <select
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-[8px] text-sm focus:outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="">-- Choose Rejection Reason --</option>
                      <option value="instructions_not_followed">Instructions not followed</option>
                      <option value="recording_mismatch">Recording mismatch</option>
                      <option value="incomplete">Incomplete submission</option>
                      <option value="low_effort">Low effort / Spam</option>
                    </select>
                  </div>

                  {/* Rejection Explanation input */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Text Explanation (2-3 Sentences Mandatory)
                      </label>
                      <span className={`text-[10px] font-bold ${
                        rejectionExplanation.trim().length >= 10 && rejectionExplanation.trim().length <= 500
                          ? 'text-emerald-600'
                          : 'text-rose-500'
                      }`}>
                        {rejectionExplanation.trim().length} / 500 characters
                      </span>
                    </div>
                    <textarea
                      value={rejectionExplanation}
                      onChange={(e) => setRejectionExplanation(e.target.value)}
                      placeholder="Provide details on what instruction was missed or mismatch identified. E.g. 'The screen recording did not capture the payment checkout. You must show the GCash window and callback screen as requested in the listing instructions. Please submit a new attempt with correct recording.'"
                      rows={5}
                      maxLength={500}
                      className="w-full p-2.5 border border-gray-200 rounded-[8px] text-sm focus:outline-none focus:border-blue-500 bg-white leading-relaxed"
                    />
                    <span className="text-[10px] text-gray-400 block mt-1">
                      Must be between 10 and 500 characters.
                    </span>
                  </div>

                  {/* Rejection Attachment input */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                      Attach Voice/Video Explanation (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="audio/*,video/*"
                        onChange={(e) => {
                          setRejectionAttachmentError(null);
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          if (file.size > 25 * 1024 * 1024) {
                            setRejectionAttachmentError('File must be under 25MB');
                            e.target.value = '';
                            return;
                          }
                          
                          setRejectionAttachment(file);
                          setRejectionAttachmentPreview(`${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
                        }}
                        className="hidden"
                        id="rejection-attachment-upload"
                      />
                      {!rejectionAttachment ? (
                        <label
                          htmlFor="rejection-attachment-upload"
                          className="flex items-center justify-center gap-2 w-full p-2.5 border border-gray-200 border-dashed rounded-[8px] text-sm text-gray-500 hover:bg-gray-50 cursor-pointer bg-white transition-colors"
                        >
                          <Paperclip className="w-4 h-4" />
                          <span>Select Audio or Video File</span>
                        </label>
                      ) : (
                        <div className="flex items-center justify-between p-2.5 border border-gray-200 rounded-[8px] bg-gray-50">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <Paperclip className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <span className="text-sm text-gray-700 truncate">{rejectionAttachmentPreview}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectionAttachment(null);
                              setRejectionAttachmentPreview(null);
                              setRejectionAttachmentError(null);
                              const input = document.getElementById('rejection-attachment-upload') as HTMLInputElement;
                              if (input) input.value = '';
                            }}
                            className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    {rejectionAttachmentError && (
                      <span className="text-[10px] text-rose-500 font-bold block mt-1">
                        {rejectionAttachmentError}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 block mt-1">
                      Max file size: 25MB
                    </span>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseRejectModal}
                    className="px-4 py-2 border border-gray-200 text-gray-700 rounded-[6px] text-sm font-semibold hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectSubmission}
                    disabled={isRejecting || !rejectionReason || rejectionExplanation.trim().length < 10 || rejectionExplanation.trim().length > 500}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-sm font-semibold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isRejecting ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rejecting...</>
                    ) : (
                      'Confirm Rejection'
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Screenshot Lightbox Modal */}
      {mounted && createPortal(
        <AnimatePresence>
          {lightboxUrl && (
            <motion.div 
              key="lightbox-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-slate-950/90 z-[100] flex items-center justify-center p-4 cursor-zoom-out" 
              onClick={() => setLightboxUrl(null)}
            >
              <motion.div 
                key="lightbox-card"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="relative max-w-5xl max-h-[90vh] flex flex-col justify-center items-center" 
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setLightboxUrl(null)}
                  className="absolute -top-12 right-0 text-white hover:text-gray-300 font-semibold text-sm flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" /> Close Zoom
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lightboxUrl}
                  alt="Enlarged evidence screenshot"
                  className="max-w-full max-h-[80vh] rounded-lg object-contain shadow-2xl"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
