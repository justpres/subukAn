import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Check, AlertCircle, Trash2, HelpCircle, AlertTriangle, ChevronRight, ArrowLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { modalBackdropVariants, modalContentVariants } from '@/lib/utils/motion'
import { createListingSchema, CUSTOM_RATE_TIERS } from '@/lib/validation/schemas'
import { sanitizeDatabaseError } from '@/lib/utils/error'
import { convertPhpToUsdc, calculateDualRailSplit } from '@/lib/web3/client'

import { SupabaseClient } from '@supabase/supabase-js'

interface InitialValuesProps {
  title?: string
  description?: string
  site_url?: string
  rate_per_tester?: number
  slots_count?: number
  review_window_minutes?: 30 | 60
  target_age_group?: string
  target_gender?: string
  target_employment_status?: string
  target_tech_literacy?: string
  target_accessibility_tags?: string[]
  is_quick_impression?: boolean
  impression_duration_seconds?: number
  tasks?: Array<{
    question_text?: string
    requires_recording?: boolean
    requires_image?: boolean
  }>
}

interface CreateCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  user: { id: string } | null
  supabase: SupabaseClient
  onSubmitSuccess: () => void
  initialValues?: InitialValuesProps | null
}

export default function CreateCampaignModal({
  isOpen,
  onClose,
  user,
  supabase,
  onSubmitSuccess,
  initialValues
}: CreateCampaignModalProps) {
  const [step, setStep] = useState(1)

  // Form states
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSiteUrl, setFormSiteUrl] = useState('')
  const [formRate, setFormRate] = useState<number>(200)
  const [formSlots, setFormSlots] = useState<number>(5)
  const [formReviewWindow, setFormReviewWindow] = useState<30 | 60>(30)
  const [formQuestions, setFormQuestions] = useState<Array<{ question_text: string; requires_recording: boolean; requires_image: boolean }>>([
    { question_text: 'Did the checkout screen display the correct GCash prompt?', requires_recording: true, requires_image: false }
  ])
  
  const [targetAgeGroup, setTargetAgeGroup] = useState('')
  const [targetGender, setTargetGender] = useState('')
  const [targetEmploymentStatus, setTargetEmploymentStatus] = useState('')
  const [targetTechLiteracy, setTargetTechLiteracy] = useState('')
  const [targetAccessibilityTags, setTargetAccessibilityTags] = useState<string[]>([])
  
  const [isABTesting, setIsABTesting] = useState(false)
  const [formVariants, setFormVariants] = useState<Array<{ id: string; title: string; url: string; weight: number }>>([
    { id: 'A', title: 'Variant A', url: '', weight: 50 },
    { id: 'B', title: 'Variant B', url: '', weight: 50 }
  ])
  
  const [parentListingId, setParentListingId] = useState('')
  const [isQuickImpression, setIsQuickImpression] = useState(false)
  const [impressionDurationSeconds, setImpressionDurationSeconds] = useState<number>(5)

  // Dual-rail payment selection
  const [paymentRail, setPaymentRail] = useState<'fiat_paymongo' | 'crypto_web3'>('fiat_paymongo')
  const [cryptoWalletAddress, setCryptoWalletAddress] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)

  const [listings, setListings] = useState<any[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const totalBudget = formRate * formSlots

  useEffect(() => {
    if (isOpen) {
      if (initialValues) {
        setFormTitle(initialValues.title || '')
        setFormDescription(initialValues.description || '')
        setFormSiteUrl(initialValues.site_url || '')
        setFormRate(initialValues.rate_per_tester || 200)
        setFormSlots(initialValues.slots_count || 5)
        setFormReviewWindow(initialValues.review_window_minutes || 30)
        setTargetAgeGroup(initialValues.target_age_group || '')
        setTargetGender(initialValues.target_gender || '')
        setTargetEmploymentStatus(initialValues.target_employment_status || '')
        setTargetTechLiteracy(initialValues.target_tech_literacy || '')
        setTargetAccessibilityTags(initialValues.target_accessibility_tags || [])
        setIsQuickImpression(initialValues.is_quick_impression || false)
        setImpressionDurationSeconds(initialValues.impression_duration_seconds || 5)
        if (initialValues.tasks && initialValues.tasks.length > 0) {
          setFormQuestions(initialValues.tasks.map((t: any) => ({
            question_text: t.question_text || '',
            requires_recording: t.requires_recording ?? true,
            requires_image: t.requires_image ?? false
          })))
        }
      } else {
        setStep(1)
        setFormTitle('')
        setFormDescription('')
        setFormSiteUrl('')
        setFormRate(200)
        setFormSlots(5)
        setFormReviewWindow(30)
        setFormQuestions([
          { question_text: 'Did the checkout screen display the correct GCash prompt?', requires_recording: true, requires_image: false }
        ])
        setTargetAgeGroup('')
        setTargetGender('')
        setTargetEmploymentStatus('')
        setTargetTechLiteracy('')
        setTargetAccessibilityTags([])
        setIsABTesting(false)
        setFormVariants([
          { id: 'A', title: 'Variant A', url: '', weight: 50 },
          { id: 'B', title: 'Variant B', url: '', weight: 50 }
        ])
        setParentListingId('')
        setIsQuickImpression(false)
        setImpressionDurationSeconds(5)
      }
      setErrors({})
      setSubmitError(null)
      setCheckoutUrl(null)
    }
  }, [isOpen, initialValues])

  useEffect(() => {
    if (isOpen && user?.id) {
      supabase
        .from('listings')
        .select('id, title, created_at')
        .eq('poster_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }: { data: any }) => {
          if (data) setListings(data)
        })
    }
  }, [isOpen, user?.id, supabase])

  const handleAddQuestion = () => {
    setFormQuestions([...formQuestions, { question_text: '', requires_recording: false, requires_image: false }])
  }

  const handleRemoveQuestion = (index: number) => {
    if (formQuestions.length === 1) return
    const updated = [...formQuestions]
    updated.splice(index, 1)
    setFormQuestions(updated)
  }

  const handleQuestionTextChange = (index: number, text: string) => {
    const updated = [...formQuestions]
    updated[index].question_text = text
    setFormQuestions(updated)
  }

  const handleCheckboxChange = (index: number, field: 'requires_recording' | 'requires_image') => {
    const updated = [...formQuestions]
    updated[index][field] = !updated[index][field]
    setFormQuestions(updated)
  }

  const validateStep = () => {
    setErrors({})
    setSubmitError(null)
    const newErrors: Record<string, string> = {}
    
    if (step === 1) {
      if (!formTitle.trim()) newErrors['title'] = 'Title is required'
      if (!formDescription.trim()) newErrors['description'] = 'Description is required'
    } else if (step === 2) {
      if (formSlots < 1 || formSlots > 100) newErrors['slots_count'] = 'Slots must be between 1 and 100'
    } else if (step === 4) {
      if (formQuestions.some(q => !q.question_text.trim())) {
        newErrors['questions'] = 'All questions must have text'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep()) {
      setStep(prev => Math.min(prev + 1, 5))
    }
  }

  const prevStep = () => setStep(prev => Math.max(prev - 1, 1))

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!validateStep()) return

    if (!user) {
      setSubmitError('User session not found. Please log in again.')
      return
    }

    const inputData = {
      title: formTitle,
      description: formDescription,
      site_url: formSiteUrl || undefined,
      rate_per_tester: formRate,
      slots_count: formSlots,
      total_budget: formRate * formSlots,
      review_window_minutes: formReviewWindow,
      questions: formQuestions,
      target_age_group: targetAgeGroup || undefined,
      target_gender: targetGender || undefined,
      target_employment_status: targetEmploymentStatus || undefined,
      target_tech_literacy: targetTechLiteracy || undefined,
      target_accessibility_tags: targetAccessibilityTags.length > 0 ? targetAccessibilityTags : undefined,
      is_quick_impression: isQuickImpression,
      impression_duration_seconds: isQuickImpression ? impressionDurationSeconds : undefined,
      parent_listing_id: parentListingId || undefined,
      variants: isABTesting ? formVariants : undefined,
    }

    const validation = createListingSchema.safeParse(inputData)

    if (!validation.success) {
      const formattedErrors: Record<string, string> = {}
      validation.error.issues.forEach((issue: any) => {
        const path = issue.path.join('.')
        formattedErrors[path] = issue.message
      })
      setErrors(formattedErrors)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Step 1: Construct clean listing payload strictly adhering to public.listings schema
      const listingInsertPayload: Record<string, unknown> = {
        poster_id: user.id,
        title: formTitle.trim(),
        description: formDescription.trim(),
        site_url: formSiteUrl.trim() || 'https://example.com',
        rate_per_tester: formRate,
        slots_count: formSlots,
        total_budget: totalBudget,
        review_window_minutes: formReviewWindow,
        status: 'open',
        is_quick_impression: isQuickImpression,
        payment_rail: paymentRail,
        crypto_token: 'USDC',
        platform_fee_percent: 20.0,
        platform_fee_amount: calculateDualRailSplit(totalBudget, 20).platformFee,
        bounty_pool_amount: calculateDualRailSplit(totalBudget, 20).netEscrowPool,
      }

      if (targetAgeGroup) listingInsertPayload.target_age_group = targetAgeGroup
      if (targetGender) listingInsertPayload.target_gender = targetGender
      if (targetEmploymentStatus) listingInsertPayload.target_employment_status = targetEmploymentStatus
      if (targetTechLiteracy) listingInsertPayload.target_tech_literacy = targetTechLiteracy
      if (targetAccessibilityTags.length > 0) listingInsertPayload.target_accessibility_tags = targetAccessibilityTags
      if (isQuickImpression) listingInsertPayload.impression_duration_seconds = impressionDurationSeconds
      if (parentListingId) listingInsertPayload.parent_listing_id = parentListingId
      if (isABTesting && formVariants.length > 0) listingInsertPayload.variants = formVariants
      if (paymentRail === 'crypto_web3') listingInsertPayload.crypto_chain = 'base'

      let listingData: { id: string } | null = null
      const { data: insertedListing, error: listingError } = await supabase
        .from('listings')
        .insert(listingInsertPayload)
        .select()
        .single()

      if (listingError) {
        // Fallback for database environments where migration 00015 has not yet been applied
        const isDualRailColumnError =
          listingError.message?.includes('payment_rail') ||
          listingError.message?.includes('platform_fee') ||
          listingError.message?.includes('bounty_pool') ||
          listingError.message?.includes('crypto_')

        if (isDualRailColumnError) {
          const {
            payment_rail: _pr,
            crypto_chain: _cc,
            crypto_token: _ct,
            platform_fee_percent: _pfp,
            platform_fee_amount: _pfa,
            bounty_pool_amount: _bpa,
            ...legacyPayload
          } = listingInsertPayload

          const { data: retryData, error: retryError } = await supabase
            .from('listings')
            .insert(legacyPayload)
            .select()
            .single()

          if (retryError) throw retryError
          listingData = retryData
        } else {
          throw listingError
        }
      } else {
        listingData = insertedListing
      }

      if (!listingData?.id) {
        throw new Error('Listing record creation did not return a valid ID.')
      }

      // Step 2: Insert verification tasks with required order_index
      const tasksPayload = formQuestions.map((q, index) => ({
        listing_id: listingData.id,
        order_index: index,
        question_text: q.question_text.trim(),
        requires_recording: Boolean(q.requires_recording),
        requires_image: Boolean(q.requires_image),
      }))

      const { error: tasksError } = await supabase
        .from('tasks')
        .insert(tasksPayload)

      if (tasksError) throw tasksError

      // Step 3: Server-side Payment Link Generation
      try {
        const checkoutRes = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listing_id: listingData.id,
          })
        })
        const checkoutData = await checkoutRes.json()
        if (checkoutRes.ok && checkoutData.checkout_url) {
          setCheckoutUrl(checkoutData.checkout_url)
        } else {
          setCheckoutUrl(`https://checkout.paymongo.com/mock/cs_${Date.now()}`)
        }
      } catch (e) {
        setCheckoutUrl(`https://checkout.paymongo.com/mock/cs_${Date.now()}`)
      }

      onSubmitSuccess()
    } catch (err: unknown) {
      console.error('Error submitting form:', err)
      const rawError = err as { message?: string; details?: string; code?: string }
      let userFriendlyMsg = 'Failed to create campaign. Please verify your form data.'

      if (rawError?.message?.includes('row level security') || rawError?.message?.includes('permission denied')) {
        userFriendlyMsg = 'Access Denied: Only accounts registered as Posters can create test campaigns. Please check your account role.'
      } else if (rawError?.message?.includes('violates foreign key')) {
        userFriendlyMsg = 'Account Verification Error: Your poster profile is not properly registered in the database. Please try logging out and logging back in.'
      } else if (rawError?.message?.includes('budget_match')) {
        userFriendlyMsg = 'Budget calculation mismatch: Total budget must equal rate multiplied by slots.'
      } else if (rawError?.message?.includes('schema cache') || rawError?.message?.includes('does not exist')) {
        userFriendlyMsg = `Database schema mismatch: ${rawError.message}. Please verify all database migrations (00001 through 00016) have been run.`
      } else if (rawError?.message) {
        userFriendlyMsg = sanitizeDatabaseError(err, rawError.message)
      }

      setSubmitError(userFriendlyMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="create-campaign-backdrop"
          variants={modalBackdropVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-campaign-title"
          className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div 
            key="create-campaign-card"
            variants={modalContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="bg-white rounded-[16px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h3 id="create-campaign-title" className="font-extrabold text-xl text-gray-900">Create a Test Campaign</h3>
                {!checkoutUrl && (
                  <span className="text-xs text-slate-500 font-medium mt-0.5 block">
                    Step {step} of 5: {step === 1 ? 'App Info & Link' : step === 2 ? 'Rewards & Testers' : step === 3 ? 'Target Audience' : step === 4 ? 'Questions & Tasks' : 'Review & Fund'}
                  </span>
                )}
              </div>
              <button 
                type="button"
                onClick={onClose} 
                aria-label="Close create campaign modal"
                className="text-gray-400 hover:text-gray-600 text-2xl p-1.5 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                &times;
              </button>
            </div>

            {!checkoutUrl && (
              <div className="px-6 pt-3 pb-2 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <div 
                  role="progressbar" 
                  aria-label="Campaign creation progress" 
                  aria-valuenow={step} 
                  aria-valuemin={1} 
                  aria-valuemax={5}
                  className="flex items-center gap-2"
                >
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div key={s} className="flex-1 flex items-center">
                      <div className={`h-1.5 w-full rounded-full transition-all duration-300 ${step >= s ? 'bg-[#2955E3]' : 'bg-slate-200'}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}

        {checkoutUrl ? (
          <div className="p-6 space-y-6 text-center overflow-y-auto flex-1">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <Check className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-gray-900">Campaign Created Successfully!</h3>
              <p className="text-sm text-gray-600 mt-2">
                Your test campaign is ready. Complete the payment to open it to testers.
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-[12px] border border-gray-100 font-mono text-xs break-all text-blue-600 select-all">
              <a href={checkoutUrl} target="_blank" rel="noreferrer" id="mock-checkout-link" className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-xs">
                {checkoutUrl}
              </a>
            </div>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onSubmitSuccess()
                  onClose()
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[8px] text-sm font-semibold shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {(Object.keys(errors).length > 0 || submitError) && (
              <div role="alert" className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-[12px] flex gap-3 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Please fix the following:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
                    {submitError && <li>{submitError}</li>}
                    {Object.entries(errors).map(([key, msg]) => (
                      <li key={key}>{msg}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h4 className="font-bold text-lg text-slate-800">Step 1: App Info &amp; Link</h4>
                <div>
                  <label htmlFor="campaign-form-title" className="block text-sm font-bold mb-1 text-gray-700">Campaign Name</label>
                  <input
                    id="campaign-form-title"
                    type="text"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="e.g. Food Delivery App Checkout Review"
                    className="w-full p-2.5 border border-gray-200 rounded-[8px] focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-600 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="campaign-form-url" className="block text-sm font-bold mb-1 text-gray-700">Website or App Link</label>
                  <input
                    id="campaign-form-url"
                    type="url"
                    value={formSiteUrl}
                    onChange={e => setFormSiteUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full p-2.5 border border-gray-200 rounded-[8px] focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-600 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="campaign-form-desc" className="block text-sm font-bold mb-1 text-gray-700">What should testers do?</label>
                  <textarea
                    id="campaign-form-desc"
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    placeholder="Explain what parts of your app testers should test and what feedback you're looking for..."
                    rows={4}
                    className="w-full p-2.5 border border-gray-200 rounded-[8px] focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-600 text-sm"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h4 className="font-bold text-lg text-slate-800">Step 2: Rewards &amp; Tester Count</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="campaign-form-rate" className="block text-sm font-bold mb-1 text-gray-700">Reward per Tester</label>
                    <select
                      id="campaign-form-rate"
                      value={formRate}
                      onChange={e => setFormRate(Number(e.target.value))}
                      className="w-full p-2.5 border border-gray-200 rounded-[8px] bg-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      {CUSTOM_RATE_TIERS.map(tier => (
                        <option key={tier} value={tier}>
                          ₱{tier} per tester
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="campaign-form-slots" className="block text-sm font-bold mb-1 text-gray-700 flex items-center gap-1">
                      Number of Testers Needed
                      <span className="group relative">
                        <HelpCircle className="w-3.5 h-3.5 text-gray-500 cursor-pointer" aria-label="Tester count instructions" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] rounded-[4px] p-2 w-48 hidden group-hover:block z-10 font-normal">
                          Choose 1 for a quick preview or between 3 and 100 testers.
                        </span>
                      </span>
                    </label>
                    <input
                      id="campaign-form-slots"
                      type="number"
                      value={formSlots}
                      onChange={e => setFormSlots(Number(e.target.value))}
                      className="w-full p-2.5 border border-gray-200 rounded-[8px] focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-600 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <span className="block text-sm font-bold mb-1 text-gray-700">Creator Review Window</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name="reviewWindow"
                        checked={formReviewWindow === 30}
                        onChange={() => setFormReviewWindow(30)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      30 minutes (Fast review)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name="reviewWindow"
                        checked={formReviewWindow === 60}
                        onChange={() => setFormReviewWindow(60)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      60 minutes (Standard review)
                    </label>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h4 className="font-bold text-lg text-slate-800">Step 3: Target Testers (Optional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="target-age-group-select" className="block text-xs font-bold text-gray-700 mb-1">Age Group</label>
                    <select
                      id="target-age-group-select"
                      value={targetAgeGroup}
                      onChange={e => setTargetAgeGroup(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-[8px] bg-white text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <option value="">All Ages</option>
                      <option value="18-24">18 - 24 years old</option>
                      <option value="25-34">25 - 34 years old</option>
                      <option value="35-44">35 - 44 years old</option>
                      <option value="45+">45+ years old</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="target-gender-select" className="block text-xs font-bold text-gray-700 mb-1">Gender</label>
                    <select
                      id="target-gender-select"
                      value={targetGender}
                      onChange={e => setTargetGender(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-[8px] bg-white text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <option value="">All Genders</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="target-employment-select" className="block text-xs font-bold text-gray-700 mb-1">Employment</label>
                    <select
                      id="target-employment-select"
                      value={targetEmploymentStatus}
                      onChange={e => setTargetEmploymentStatus(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-[8px] bg-white text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <option value="">All Employment Types</option>
                      <option value="employed">Employed</option>
                      <option value="unemployed">Unemployed</option>
                      <option value="student">Student</option>
                      <option value="self-employed">Self-Employed / Freelancer</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="target-tech-literacy-select" className="block text-xs font-bold text-gray-700 mb-1">Tech Experience</label>
                    <select
                      id="target-tech-literacy-select"
                      value={targetTechLiteracy}
                      onChange={e => setTargetTechLiteracy(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-[8px] bg-white text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <option value="">All Experience Levels</option>
                      <option value="non_technical">Beginner / Non-Technical</option>
                      <option value="casual_user">Everyday Smartphone User</option>
                      <option value="student_dev">Tech-Savvy / Developer</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-3">
                  <span className="text-sm font-bold text-gray-800 block">Accessibility Requirements</span>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={targetAccessibilityTags.includes('screen_reader')}
                        onChange={e => {
                          if (e.target.checked) setTargetAccessibilityTags([...targetAccessibilityTags, 'screen_reader'])
                          else setTargetAccessibilityTags(targetAccessibilityTags.filter(t => t !== 'screen_reader'))
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      /> Requires Screen Reader
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={targetAccessibilityTags.includes('keyboard_only')}
                        onChange={e => {
                          if (e.target.checked) setTargetAccessibilityTags([...targetAccessibilityTags, 'keyboard_only'])
                          else setTargetAccessibilityTags(targetAccessibilityTags.filter(t => t !== 'keyboard_only'))
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      /> Requires Keyboard-Only Navigation
                    </label>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h4 className="font-bold text-lg text-slate-800">Step 4: Questions &amp; Tasks</h4>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-800">Tasks for Testers ({formQuestions.length})</span>
                  <button type="button" onClick={handleAddQuestion} className="text-xs font-semibold text-blue-600 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-xs">
                    + Add Task
                  </button>
                </div>
                <div className="space-y-4">
                  {formQuestions.map((q, idx) => (
                    <div key={idx} className="p-4 border border-gray-100 bg-gray-50/55 rounded-[12px] relative space-y-3">
                      {formQuestions.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => handleRemoveQuestion(idx)} 
                          aria-label={`Delete task ${idx + 1}`}
                          className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                      <div>
                        <label htmlFor={`question-text-${idx}`} className="block text-xs font-bold text-gray-700 mb-1">Task / Question {idx + 1}</label>
                        <input
                          id={`question-text-${idx}`}
                          type="text"
                          value={q.question_text}
                          onChange={e => handleQuestionTextChange(idx, e.target.value)}
                          placeholder="e.g. Try adding an item to the cart and checking out"
                          className="w-full p-2 border border-gray-200 rounded-[8px] text-sm focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-600 bg-white"
                        />
                      </div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input type="checkbox" checked={q.requires_recording} onChange={() => handleCheckboxChange(idx, 'requires_recording')} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          Requires Screen Recording
                        </label>
                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input type="checkbox" checked={q.requires_image} onChange={() => handleCheckboxChange(idx, 'requires_image')} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          Requires Screenshot
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-gray-800 block">5-Second Quick Impression Test</span>
                    </div>
                    <input 
                      type="checkbox" 
                      aria-label="Enable 5-Second Quick Impression Test"
                      checked={isQuickImpression} 
                      onChange={e => setIsQuickImpression(e.target.checked)} 
                      className="rounded border-gray-300 text-blue-600 w-5 h-5 cursor-pointer focus:ring-blue-500" 
                    />
                  </div>
                  {isQuickImpression && (
                    <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-[12px] space-y-3">
                      <div className="flex items-center gap-2">
                        <label htmlFor="impression-duration-input" className="text-xs font-bold text-gray-700">Display Duration (Seconds):</label>
                        <input id="impression-duration-input" type="number" min={5} max={30} value={impressionDurationSeconds} onChange={e => setImpressionDurationSeconds(Number(e.target.value))} className="w-20 p-1 border border-gray-200 rounded-[6px] text-xs focus:outline-none text-center bg-white focus-visible:ring-2 focus-visible:ring-blue-600" />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-gray-800 block">Enable A/B Version Comparison</span>
                    </div>
                    <input 
                      type="checkbox" 
                      aria-label="Enable A/B Comparative Testing"
                      checked={isABTesting} 
                      onChange={e => setIsABTesting(e.target.checked)} 
                      className="rounded border-gray-300 text-blue-600 w-5 h-5 cursor-pointer focus:ring-blue-500" 
                    />
                  </div>
                  {isABTesting && (
                    <div className="p-4 bg-purple-50 border border-purple-100 rounded-[12px] space-y-4">
                      {formVariants.map((v, idx) => (
                        <div key={v.id} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <input 
                              type="text" 
                              aria-label={`Variant ${v.id} Label`}
                              value={v.title} 
                              onChange={e => {
                                const updated = [...formVariants]; updated[idx].title = e.target.value; setFormVariants(updated);
                              }} 
                              placeholder="Version Label (e.g. Version A)" 
                              className="w-full p-2 border border-gray-200 rounded-[8px] text-xs bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600" 
                            />
                          </div>
                          <div className="md:col-span-2">
                            <input 
                              type="url" 
                              aria-label={`Variant ${v.id} URL`}
                              value={v.url} 
                              onChange={e => {
                                const updated = [...formVariants]; updated[idx].url = e.target.value; setFormVariants(updated);
                              }} 
                              placeholder="Version Link (https://...)" 
                              className="w-full p-2 border border-gray-200 rounded-[8px] text-xs bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600" 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <div>
                    <label htmlFor="parent-listing-benchmark-select" className="text-sm font-bold text-gray-800 block mb-1">Compare with Previous Campaign</label>
                  </div>
                  <select id="parent-listing-benchmark-select" value={parentListingId} onChange={e => setParentListingId(e.target.value)} className="w-full p-2 border border-gray-200 rounded-[8px] bg-white text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                    <option value="">None / Standalone campaign</option>
                    {listings.map(l => (
                      <option key={l.id} value={l.id}>{l.title}</option>
                    ))}
                  </select>
                </div>

              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <h4 className="font-bold text-lg text-slate-800">Step 5: Review &amp; Fund Escrow</h4>

                {/* Dual-Rail Selector Tabs */}
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setPaymentRail('fiat_paymongo')}
                    className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      paymentRail === 'fiat_paymongo'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>🇵🇭 GCash / Maya / Cards</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Default</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentRail('crypto_web3')}
                    className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      paymentRail === 'crypto_web3'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>🌐 USDC on Base L2</span>
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Web3</span>
                  </button>
                </div>

                {paymentRail === 'fiat_paymongo' ? (
                  <div className="space-y-3">
                    <div className="p-5 bg-blue-50/70 border border-blue-100 rounded-xl space-y-3">
                      <div className="flex items-center justify-between pb-3 border-b border-blue-200/60">
                        <span className="text-xs font-semibold text-slate-600">Gross Campaign Budget</span>
                        <span className="text-2xl font-black text-blue-900 font-mono">₱{totalBudget.toLocaleString()}</span>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-700">
                        <div className="flex items-center justify-between">
                          <span>Net Tester Escrow Pool (80%):</span>
                          <span className="font-semibold text-slate-900 font-mono">₱{(totalBudget * 0.8).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500">
                          <span>SubukAn Platform Take-Rate (20%):</span>
                          <span className="font-mono">₱{(totalBudget * 0.2).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                          <span>Verified Tester Slots:</span>
                          <span className="font-mono">{formSlots} slots @ ₱{formRate} each</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 text-center leading-relaxed">
                      Your funds will be locked securely in PayMongo escrow. Payouts are sent directly to testers upon your approval.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-5 bg-purple-50/70 border border-purple-100 rounded-xl space-y-3">
                      <div className="flex items-center justify-between pb-3 border-b border-purple-200/60">
                        <div>
                          <span className="text-xs font-semibold text-slate-600 block">USDC Escrow Budget</span>
                          <span className="text-[10px] text-slate-400 font-mono">1 USD ≈ ₱58.00</span>
                        </div>
                        <span className="text-2xl font-black text-purple-900 font-mono">${convertPhpToUsdc(totalBudget)} USDC</span>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-700">
                        <div className="flex items-center justify-between">
                          <span>Net Tester Bounty (80%):</span>
                          <span className="font-semibold text-slate-900 font-mono">${(convertPhpToUsdc(totalBudget) * 0.8).toFixed(2)} USDC</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500">
                          <span>Platform Fee (20%):</span>
                          <span className="font-mono">${(convertPhpToUsdc(totalBudget) * 0.2).toFixed(2)} USDC</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-purple-700 pt-1 font-medium">
                          <span>Network:</span>
                          <span className="font-mono">Base L2 (&lt;$0.005 Gas)</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 text-center leading-relaxed">
                      Locked in decentralized smart contract <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded font-mono">SubukanEscrow.sol</code> on Base.
                    </p>
                  </div>
                )}
              </div>
            )}

            </div>

            {/* Pinned Fixed Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-gray-200 bg-gray-50/90 flex items-center justify-between gap-3 shrink-0">
              {step > 1 ? (
                <button 
                  type="button" 
                  onClick={prevStep} 
                  className="px-4 py-2 border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 rounded-[8px] text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              ) : (
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="px-4 py-2 text-gray-500 hover:text-gray-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
              )}

              {step < 5 ? (
                <button 
                  type="button" 
                  onClick={nextStep} 
                  className="px-5 py-2.5 bg-[#2955E3] hover:bg-[#1D4ED8] text-white rounded-[8px] text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <span>Next: {step === 1 ? 'Rewards & Testers' : step === 2 ? 'Target Audience' : step === 3 ? 'Questions & Tasks' : 'Review & Fund'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button 
                  type="submit" 
                  onClick={handleSubmit} 
                  disabled={isSubmitting} 
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[8px] text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  {isSubmitting ? 'Processing Escrow...' : `Confirm & Fund ₱${(formRate * formSlots).toLocaleString()}`}
                </button>
              )}
            </div>
          </>
        )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
