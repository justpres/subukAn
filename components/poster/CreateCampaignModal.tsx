import React, { useState, useEffect } from 'react'
import { Check, AlertCircle, Trash2, HelpCircle, AlertTriangle } from 'lucide-react'
import { createListingSchema, CUSTOM_RATE_TIERS } from '@/lib/validation/schemas'
import { sanitizeDatabaseError } from '@/lib/utils/error'

interface CreateCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  user: any
  supabase: any
  onSubmitSuccess: () => void
  initialValues?: any
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

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)

  const [listings, setListings] = useState<any[]>([])

  useEffect(() => {
    if (isOpen) {
      if (initialValues) {
        setFormTitle(initialValues.title || '')
        setFormDescription(initialValues.description || '')
        setFormSiteUrl(initialValues.site_url || '')
        setFormRate(initialValues.rate_per_tester || 200)
        setFormSlots(initialValues.slots_count || 5)
        setFormReviewWindow(initialValues.review_window_minutes || 30)
      }
      setStep(1)
      setCheckoutUrl(null)
      fetchListingsForDropdown()
    }
  }, [isOpen, initialValues])

  const fetchListingsForDropdown = async () => {
    if (!user) return
    const { data } = await supabase
      .from('listings')
      .select('id, title, created_at')
      .eq('poster_id', user.id)
      .order('created_at', { ascending: false })
    if (data) {
      setListings(data)
    }
  }

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

    try {
      const { data: newListing, error: listingError } = await supabase
        .from('listings')
        .insert({
          poster_id: user.id,
          title: formTitle,
          description: formDescription,
          site_url: formSiteUrl || null,
          rate_per_tester: formRate,
          slots_count: formSlots,
          total_budget: formRate * formSlots,
          review_window_minutes: formReviewWindow,
          status: 'open',
          target_age_group: targetAgeGroup || null,
          target_gender: targetGender || null,
          target_employment_status: targetEmploymentStatus || null,
          target_tech_literacy: targetTechLiteracy || null,
          target_accessibility_tags: targetAccessibilityTags,
          is_quick_impression: isQuickImpression,
          impression_duration_seconds: isQuickImpression ? impressionDurationSeconds : null,
          parent_listing_id: parentListingId || null,
          variants: isABTesting ? formVariants : [],
        })
        .select()
        .single()

      if (listingError) throw listingError
      if (!newListing) throw new Error('Listing creation returned no data.')

      const tasksData = formQuestions.map((q, index) => ({
        listing_id: newListing.id,
        order_index: index,
        question_text: q.question_text,
        requires_recording: q.requires_recording,
        requires_image: q.requires_image
      }))

      const { error: tasksError } = await supabase.from('tasks').insert(tasksData)
      if (tasksError) throw tasksError

      const mockLinkId = `link_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`
      const mockUrl = `https://checkout.paymongo.com/mock/${mockLinkId}?ref=${newListing.id}&amt=${newListing.total_budget * 100}`
      setCheckoutUrl(mockUrl)
      onSubmitSuccess()
    } catch (err: any) {
      setSubmitError(sanitizeDatabaseError(err, 'An error occurred during submission.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[12px] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-extrabold text-xl">Create New Testing Round</h3>
          <button 
            type="button"
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 text-lg"
          >
            &times;
          </button>
        </div>

        {checkoutUrl ? (
          <div className="p-6 space-y-6 text-center overflow-y-auto flex-1">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg">Listing Created & Pending Escrow</h3>
              <p className="text-sm text-gray-500 mt-2">
                Your testing round has been created. Complete the mock payment to activate your listing.
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-[12px] border border-gray-100 font-mono text-xs break-all text-blue-600 select-all">
              <a href={checkoutUrl} target="_blank" rel="noreferrer" id="mock-checkout-link" className="hover:underline">
                {checkoutUrl}
              </a>
            </div>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[8px] text-sm font-semibold shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className="flex-1 flex items-center">
                  <div className={`h-2 w-full rounded-[4px] ${step >= s ? 'bg-blue-600' : 'bg-gray-200'}`} />
                </div>
              ))}
            </div>

            {(Object.keys(errors).length > 0 || submitError) && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-[12px] flex gap-3 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-semibold">Please correct the errors:</p>
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
                <h4 className="font-bold text-lg text-slate-800">Step 1: Basics & URL</h4>
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Listing Title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="e.g., Rider App Map Pin Accuracy Review"
                    className="w-full p-2.5 border border-gray-200 rounded-[8px] focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Site URL</label>
                  <input
                    type="url"
                    value={formSiteUrl}
                    onChange={e => setFormSiteUrl(e.target.value)}
                    placeholder="https://example.com — the site testers will visit"
                    className="w-full p-2.5 border border-gray-200 rounded-[8px] focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Description</label>
                  <textarea
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    placeholder="Describe step-by-step what the tester needs to do and check..."
                    rows={4}
                    className="w-full p-2.5 border border-gray-200 rounded-[8px] focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h4 className="font-bold text-lg text-slate-800">Step 2: Rate & Slots</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1 text-gray-700">Rate per Tester</label>
                    <select
                      value={formRate}
                      onChange={e => setFormRate(Number(e.target.value))}
                      className="w-full p-2.5 border border-gray-200 rounded-[8px] bg-white text-sm focus:outline-none"
                    >
                      {CUSTOM_RATE_TIERS.map(tier => (
                        <option key={tier} value={tier}>
                          ₱{tier} per tester
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 text-gray-700 flex items-center gap-1">
                      Slots Count 
                      <span className="group relative">
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-pointer" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] rounded-[4px] p-2 w-48 hidden group-hover:block z-10 font-normal">
                          Must be 1 (for preview round) or between 3 and 100.
                        </span>
                      </span>
                    </label>
                    <input
                      type="number"
                      value={formSlots}
                      onChange={e => setFormSlots(Number(e.target.value))}
                      className="w-full p-2.5 border border-gray-200 rounded-[8px] focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Poster Review Window</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={formReviewWindow === 30}
                        onChange={() => setFormReviewWindow(30)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      30 minutes (Fast validation)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={formReviewWindow === 60}
                        onChange={() => setFormReviewWindow(60)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      60 minutes (Standard listing)
                    </label>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h4 className="font-bold text-lg text-slate-800">Step 3: Target Demographics</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Target Age Group</label>
                    <select
                      value={targetAgeGroup}
                      onChange={e => setTargetAgeGroup(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-[8px] bg-white text-xs focus:outline-none"
                    >
                      <option value="">All Age Groups</option>
                      <option value="18-24">18 - 24 years old</option>
                      <option value="25-34">25 - 34 years old</option>
                      <option value="35-44">35 - 44 years old</option>
                      <option value="45+">45+ years old</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Target Gender</label>
                    <select
                      value={targetGender}
                      onChange={e => setTargetGender(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-[8px] bg-white text-xs focus:outline-none"
                    >
                      <option value="">All Genders</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Employment Status</label>
                    <select
                      value={targetEmploymentStatus}
                      onChange={e => setTargetEmploymentStatus(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-[8px] bg-white text-xs focus:outline-none"
                    >
                      <option value="">All Employment Statuses</option>
                      <option value="employed">Employed</option>
                      <option value="unemployed">Unemployed</option>
                      <option value="student">Student</option>
                      <option value="self-employed">Self-Employed / Freelancer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Target Tech Literacy</label>
                    <select
                      value={targetTechLiteracy}
                      onChange={e => setTargetTechLiteracy(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-[8px] bg-white text-xs focus:outline-none"
                    >
                      <option value="">All Literacy Levels</option>
                      <option value="non_technical">Non-Technical</option>
                      <option value="casual_user">Casual User</option>
                      <option value="student_dev">Developer / Technical</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-800 block">Accessibility Requirements</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={targetAccessibilityTags.includes('screen_reader')}
                        onChange={e => {
                          if (e.target.checked) setTargetAccessibilityTags([...targetAccessibilityTags, 'screen_reader'])
                          else setTargetAccessibilityTags(targetAccessibilityTags.filter(t => t !== 'screen_reader'))
                        }}
                        className="rounded border-gray-300 text-blue-600"
                      /> Requires Screen Reader
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={targetAccessibilityTags.includes('keyboard_only')}
                        onChange={e => {
                          if (e.target.checked) setTargetAccessibilityTags([...targetAccessibilityTags, 'keyboard_only'])
                          else setTargetAccessibilityTags(targetAccessibilityTags.filter(t => t !== 'keyboard_only'))
                        }}
                        className="rounded border-gray-300 text-blue-600"
                      /> Requires Keyboard-Only Nav
                    </label>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h4 className="font-bold text-lg text-slate-800">Step 4: Verification Questions</h4>
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-gray-800">Testing Steps ({formQuestions.length})</label>
                  <button type="button" onClick={handleAddQuestion} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                    + Add Question
                  </button>
                </div>
                <div className="space-y-4">
                  {formQuestions.map((q, idx) => (
                    <div key={idx} className="p-4 border border-gray-100 bg-gray-50/55 rounded-[12px] relative space-y-3">
                      {formQuestions.length > 1 && (
                        <button type="button" onClick={() => handleRemoveQuestion(idx)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Question {idx + 1}</label>
                        <input
                          type="text"
                          value={q.question_text}
                          onChange={e => handleQuestionTextChange(idx, e.target.value)}
                          placeholder="e.g. Can you complete checkout?"
                          className="w-full p-2 border border-gray-200 rounded-[8px] text-sm focus:outline-none focus:border-blue-500 bg-white"
                        />
                      </div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                          <input type="checkbox" checked={q.requires_recording} onChange={() => handleCheckboxChange(idx, 'requires_recording')} className="rounded border-gray-300 text-blue-600" />
                          Requires Screen Recording
                        </label>
                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                          <input type="checkbox" checked={q.requires_image} onChange={() => handleCheckboxChange(idx, 'requires_image')} className="rounded border-gray-300 text-blue-600" />
                          Requires Image Screenshot
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-bold text-gray-800 block">5-Second Quick Impression Test</label>
                    </div>
                    <input type="checkbox" checked={isQuickImpression} onChange={e => setIsQuickImpression(e.target.checked)} className="rounded border-gray-300 text-blue-600 w-5 h-5 cursor-pointer" />
                  </div>
                  {isQuickImpression && (
                    <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-[12px] space-y-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-700">Impression Duration (Sec):</label>
                        <input type="number" min={5} max={30} value={impressionDurationSeconds} onChange={e => setImpressionDurationSeconds(Number(e.target.value))} className="w-20 p-1 border border-gray-200 rounded-[6px] text-xs focus:outline-none text-center bg-white" />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-bold text-gray-800 block">Enable A/B Comparative Testing</label>
                    </div>
                    <input type="checkbox" checked={isABTesting} onChange={e => setIsABTesting(e.target.checked)} className="rounded border-gray-300 text-blue-600 w-5 h-5 cursor-pointer" />
                  </div>
                  {isABTesting && (
                    <div className="p-4 bg-purple-50 border border-purple-100 rounded-[12px] space-y-4">
                      {formVariants.map((v, idx) => (
                        <div key={v.id} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <input type="text" value={v.title} onChange={e => {
                              const updated = [...formVariants]; updated[idx].title = e.target.value; setFormVariants(updated);
                            }} placeholder="Variant Label" className="w-full p-2 border border-gray-200 rounded-[8px] text-xs bg-white focus:outline-none" />
                          </div>
                          <div className="md:col-span-2">
                            <input type="url" value={v.url} onChange={e => {
                              const updated = [...formVariants]; updated[idx].url = e.target.value; setFormVariants(updated);
                            }} placeholder="App URL" className="w-full p-2 border border-gray-200 rounded-[8px] text-xs bg-white focus:outline-none" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <div>
                    <label className="text-sm font-bold text-gray-800 block">Link to Previous Round (Benchmarking)</label>
                  </div>
                  <select value={parentListingId} onChange={e => setParentListingId(e.target.value)} className="w-full p-2 border border-gray-200 rounded-[8px] bg-white text-xs focus:outline-none">
                    <option value="">No parent / First round</option>
                    {listings.map(l => (
                      <option key={l.id} value={l.id}>{l.title}</option>
                    ))}
                  </select>
                </div>

              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <h4 className="font-bold text-lg text-slate-800">Step 5: Escrow Confirm</h4>
                <div className="p-6 bg-blue-50 border border-blue-100 rounded-[12px] flex flex-col items-center justify-center text-center space-y-2">
                  <span className="text-gray-600 text-sm font-medium">Total Escrow Budget</span>
                  <span className="text-4xl font-black text-blue-800">₱{formRate * formSlots}</span>
                  <span className="text-xs text-gray-500 mt-2">({formSlots} slots at ₱{formRate}/each)</span>
                </div>
                <p className="text-sm text-gray-600 text-center">
                  Review your settings and click confirm to deposit the funds to the escrow account via Mock PayMongo checkout.
                </p>
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-gray-200 flex justify-between gap-3">
              {step > 1 ? (
                <button type="button" onClick={prevStep} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-[8px] hover:bg-gray-100 text-sm font-semibold">
                  Back
                </button>
              ) : (
                <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-[8px] hover:bg-gray-100 text-sm font-semibold">
                  Cancel
                </button>
              )}

              {step < 5 ? (
                <button type="button" onClick={nextStep} className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-[8px] text-sm font-semibold">
                  Next
                </button>
              ) : (
                <button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[8px] text-sm font-semibold shadow-sm disabled:opacity-50 flex items-center gap-2">
                  {isSubmitting ? 'Funding...' : 'Confirm and Fund'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
