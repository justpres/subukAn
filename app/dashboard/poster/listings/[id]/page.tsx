'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Users,
  Clock,
  CheckCircle,
  FileText,
  Loader2,
  TrendingUp,
  Award,
  Eye,
  Layers,
  Activity,
  ChevronRight,
  BarChart3,
  Calendar,
  AlertCircle,
  Wallet
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'

interface Listing {
  id: string;
  title: string;
  description: string;
  rate_per_tester: number;
  slots_count: number;
  total_budget: number;
  review_window_minutes: number;
  status: string;
  created_at: string;
  variants?: Array<{ id: string; title: string; url: string; weight: number }> | null;
  parent_listing_id?: string | null;
  target_accessibility_tags?: string[] | null;
}

interface Submission {
  id: string;
  status: string;
  tester_id: string;
  assigned_variant_id?: string | null;
  submitted_at?: string | null;
  profiles?: {
    full_name: string;
  } | null;
}

interface TaskResponse {
  id: string;
  task_id: string;
  submission_id: string;
  completed_successfully: boolean;
  time_on_task_seconds: number;
  difficulty_rating: number;
  first_click_x?: number | null;
  first_click_y?: number | null;
  first_click_time_ms?: number | null;
  submission?: {
    assigned_variant_id?: string | null;
  } | null;
}

interface Task {
  id: string;
  question_text: string;
  order_index: number;
}

interface PageProps {
  params: {
    id: string;
  };
}

export default function ListingDetailsPage({ params }: PageProps) {
  const { id } = params
  const supabase = createBrowserClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'submissions' | 'comparative' | 'heatmap' | 'benchmarks'>('submissions')

  // Data states
  const [listing, setListing] = useState<Listing | null>(null)
  const [parentListing, setParentListing] = useState<Listing | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [responses, setResponses] = useState<TaskResponse[]>([])
  const [parentResponses, setParentResponses] = useState<TaskResponse[]>([])

  // Heatmap Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [timedTaskScreenshotUrl, setTimedTaskScreenshotUrl] = useState<string | null>(null)

  // Fetch Listing, Submissions, Tasks, Responses
  useEffect(() => {
    const fetchListingData = async () => {
      setLoading(true)
      setError(null)
      try {
        // 1. Fetch listing details
        const { data: listData, error: listError } = await supabase
          .from('listings')
          .select('*')
          .eq('id', id)
          .single()

        if (listError || !listData) {
          throw new Error(listError?.message || 'Listing details not found.')
        }
        setListing(listData)

        // 2. Fetch parent listing if exists
        if (listData.parent_listing_id) {
          const { data: parentData } = await supabase
            .from('listings')
            .select('*')
            .eq('id', listData.parent_listing_id)
            .single()
          if (parentData) {
            setParentListing(parentData)

            // Fetch parent task responses for comparison
            const { data: parentRespData } = await supabase
              .from('task_responses')
              .select(`
                *,
                submission:submissions (
                  id,
                  listing_id
                )
              `)
            if (parentRespData) {
              const filteredParent = parentRespData.filter((r: any) => r.submission?.listing_id === listData.parent_listing_id)
              setParentResponses(filteredParent as any[])
            }
          }
        }

        // 3. Fetch listing tasks
        const { data: taskData, error: taskError } = await supabase
          .from('tasks')
          .select('*')
          .eq('listing_id', id)
          .order('order_index', { ascending: true })

        if (!taskError && taskData) {
          setTasks(taskData)
          
          // Look for any task that has a screenshot image url to use as background for heatmap
          // In subukAn, static screenshot tests or timed display tests store screenshots in tasks (e.g. image_url / screenshot_url)
          const timedTask = taskData.find((t: any) => t.type === 'timed_impression' || t.image_url || t.screenshot_url || t.target_screenshot_image_url)
          if (timedTask) {
            const url = timedTask.image_url || timedTask.screenshot_url || timedTask.target_screenshot_image_url
            if (url) {
              setTimedTaskScreenshotUrl(url)
            }
          }
        }

        // 4. Fetch submissions with tester profiles
        const { data: subData, error: subError } = await supabase
          .from('submissions')
          .select(`
            id,
            status,
            tester_id,
            assigned_variant_id,
            submitted_at,
            profiles (
              full_name
            )
          `)
          .eq('listing_id', id)

        if (!subError && subData) {
          setSubmissions(subData.map((s: any) => ({
            id: s.id,
            status: s.status,
            tester_id: s.tester_id,
            assigned_variant_id: s.assigned_variant_id,
            submitted_at: s.submitted_at,
            profiles: s.profiles ? { full_name: s.profiles.full_name } : null
          })))
        }

        // 5. Fetch task responses
        const { data: respData, error: respError } = await supabase
          .from('task_responses')
          .select(`
            id,
            task_id,
            submission_id,
            completed_successfully,
            time_on_task_seconds,
            difficulty_rating,
            first_click_x,
            first_click_y,
            first_click_time_ms,
            submission:submissions (
              assigned_variant_id
            )
          `)
          .eq('submission:submissions.listing_id', id)

        if (!respError && respData) {
          // Filter response rows strictly for submissions of this listing
          const filteredResps = respData.filter((r: any) => r.submission !== null)
          setResponses(filteredResps as any[])
        }

      } catch (err: any) {
        console.error(err)
        setError(err.message || 'An error occurred loading listing details.')
      } finally {
        setLoading(false)
      }
    }

    fetchListingData()
  }, [id, supabase])

  // Heatmap Painter
  const handleRenderHeatmap = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Get all first click points that have coordinates
    const points = responses
      .filter(r => r.first_click_x !== null && r.first_click_x !== undefined && r.first_click_y !== null && r.first_click_y !== undefined)
      .map(r => ({
        x: r.first_click_x as number,
        y: r.first_click_y as number
      }))

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Render heat hotspots
    points.forEach(p => {
      const gradient = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 20)
      gradient.addColorStop(0, 'rgba(239, 68, 68, 1)')     // bright red center
      gradient.addColorStop(0.3, 'rgba(245, 158, 11, 0.8)')  // amber halo
      gradient.addColorStop(0.7, 'rgba(245, 158, 11, 0.3)')  // soft amber fade
      gradient.addColorStop(1, 'rgba(245, 158, 11, 0)')      // transparent edge

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(p.x, p.y, 20, 0, 2 * Math.PI)
      ctx.fill()
    })
  }, [responses])

  useEffect(() => {
    if (activeTab === 'heatmap' && imageLoaded) {
      handleRenderHeatmap()
    }
  }, [activeTab, imageLoaded, handleRenderHeatmap])

  // Helper date formatter
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Calculate generic statistics
  const approvedSubmissions = submissions.filter(s => s.status === 'approved')
  const averageDifficulty = approvedSubmissions.length > 0
    ? responses.reduce((acc, r) => acc + (r.difficulty_rating || 0), 0) / responses.length
    : 0

  const averageCompletionTime = approvedSubmissions.length > 0
    ? responses.reduce((acc, r) => acc + (r.time_on_task_seconds || 0), 0) / responses.length
    : 0

  // A/B Variant Specific metrics
  const getVariantMetrics = (variantId: string) => {
    const varSubs = submissions.filter(s => s.assigned_variant_id === variantId)
    const varCompletedSubs = varSubs.filter(s => s.status === 'approved')
    const subIds = varSubs.map(s => s.id)
    const varResps = responses.filter(r => subIds.includes(r.submission_id))

    const totalResps = varResps.length
    const successRate = totalResps > 0
      ? (varResps.filter(r => r.completed_successfully).length / totalResps) * 100
      : 0

    const avgTime = totalResps > 0
      ? varResps.reduce((sum, r) => sum + r.time_on_task_seconds, 0) / totalResps
      : 0

    const avgDiff = totalResps > 0
      ? varResps.reduce((sum, r) => sum + r.difficulty_rating, 0) / totalResps
      : 0

    return {
      completions: varCompletedSubs.length,
      slotsFilled: varSubs.length,
      successRate,
      avgTime,
      avgDiff
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-sm font-semibold text-gray-500 font-mono">Loading listing analysis dashboard...</span>
        </div>
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-[12px] p-8 max-w-md text-center shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Analysis Error</h2>
          <p className="text-sm text-gray-500">{error || 'Unable to retrieve data metrics for this testing round.'}</p>
          <Link href="/dashboard/poster" className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-[8px]">
            Back to Poster Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#1a1a1a] pb-16">
      {/* Top Banner Navigation */}
      <div className="bg-white border-b border-gray-200 py-6">
        <div className="max-w-6xl mx-auto px-6">
          <Link href="/dashboard/poster" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-955 mb-4 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{listing.title}</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold text-slate-700 bg-slate-100/90 border border-slate-200/80 shadow-2xs font-mono uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  {listing.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-medium flex items-center gap-3 mt-2">
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Created on {formatDate(listing.created_at)}</span>
                {listing.target_accessibility_tags && listing.target_accessibility_tags.length > 0 && (
                  <span className="flex items-center gap-1.5 bg-purple-50 text-purple-700 px-2 py-0.5 rounded-[4px] border border-purple-100 font-bold uppercase tracking-wider text-[10px]">
                    Accessibility Filter Active
                  </span>
                )}
              </p>
            </div>

            <div className="flex gap-4 items-center bg-gray-50 px-5 py-3 rounded-xl border border-gray-100 shrink-0">
              <div>
                <span className="text-[10px] text-gray-400 block font-bold uppercase tracking-wider">Escrow Balance</span>
                <span className="text-xl font-black text-blue-900">₱{listing.total_budget.toLocaleString()}</span>
              </div>
              <div className="border-l border-gray-200 pl-4">
                <span className="text-[10px] text-gray-400 block font-bold uppercase tracking-wider">Filled Slots</span>
                <span className="text-xl font-black text-gray-900">{submissions.filter(s => s.status !== 'expired').length} / {listing.slots_count}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 mt-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 gap-6 text-sm font-semibold mb-8">
          <button
            onClick={() => setActiveTab('submissions')}
            className={`pb-3 border-b-2 transition-all ${
              activeTab === 'submissions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Testers & Payouts</span>
          </button>
          
          {listing.variants && listing.variants.length > 0 && (
            <button
              onClick={() => setActiveTab('comparative')}
              className={`pb-3 border-b-2 transition-all ${
                activeTab === 'comparative' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center gap-1.5"><Layers className="w-4 h-4" /> A/B Testing Analytics</span>
            </button>
          )}

          {timedTaskScreenshotUrl && (
            <button
              onClick={() => setActiveTab('heatmap')}
              className={`pb-3 border-b-2 transition-all ${
                activeTab === 'heatmap' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center gap-1.5"><Eye className="w-4 h-4" /> First-Click Heatmap</span>
            </button>
          )}

          {listing.parent_listing_id && (
            <button
              onClick={() => setActiveTab('benchmarks')}
              className={`pb-3 border-b-2 transition-all ${
                activeTab === 'benchmarks' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> Version Benchmarks</span>
            </button>
          )}
        </div>

        {/* Tab Contents: Submissions & Reviews list */}
        {activeTab === 'submissions' && (
          <div className="space-y-6">
            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white border border-gray-200 rounded-[12px] p-6 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Approved Submissions</span>
                  <span className="text-2xl font-extrabold text-gray-900">{approvedSubmissions.length} rounds</span>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-[12px] p-6 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Avg. Completion Time</span>
                  <span className="text-2xl font-extrabold text-gray-900">{averageCompletionTime.toFixed(1)}s</span>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-[12px] p-6 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Avg. App Difficulty</span>
                  <span className="text-2xl font-extrabold text-gray-900">{averageDifficulty.toFixed(1)} / 5</span>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-[12px] p-6 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Escrow Payouts</span>
                    <span className="text-xl font-extrabold text-gray-900">
                      ₱{(approvedSubmissions.length * listing.rate_per_tester).toLocaleString()} <span className="text-xs font-normal text-gray-500">disbursed</span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-gray-100 pt-3 mt-3">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Budget</span>
                    <span className="font-bold text-gray-700">₱{listing.total_budget.toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Held Escrow</span>
                    <span className="font-bold text-emerald-600">₱{Math.max(0, listing.total_budget - (approvedSubmissions.length * listing.rate_per_tester)).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Question-by-Question Task Analytics */}
            <div className="bg-white border border-gray-200 rounded-[12px] p-6 shadow-sm space-y-4">
              <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    Question-by-Question Task Analytics
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Granular performance metrics breakdown per task question.</p>
                </div>
                <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 bg-slate-100/90 text-slate-700 rounded-md border border-slate-200/80 font-mono shadow-2xs">
                  {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
                </span>
              </div>

              {tasks.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 font-medium">
                  No tasks configured for this testing round.
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  {tasks.map((task, idx) => {
                    const taskResps = responses.filter(r => r.task_id === task.id);
                    const totalCount = taskResps.length;
                    const avgTime = totalCount > 0
                      ? taskResps.reduce((acc, r) => acc + (r.time_on_task_seconds || 0), 0) / totalCount
                      : 0;
                    const avgDiff = totalCount > 0
                      ? taskResps.reduce((acc, r) => acc + (r.difficulty_rating || 0), 0) / totalCount
                      : 0;
                    const successCount = taskResps.filter(r => r.completed_successfully).length;
                    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

                    return (
                      <div
                        key={task.id}
                        className="bg-gray-50/70 border border-gray-200/80 rounded-[10px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-gray-300 transition-colors"
                      >
                        <div className="space-y-1 max-w-xl">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-mono">
                              Task {task.order_index !== undefined ? task.order_index + 1 : idx + 1}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-gray-900 leading-snug">
                            {task.question_text || 'Untitled Question Task'}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-4 shrink-0 bg-white p-3 rounded-lg border border-gray-100 shadow-2xs text-center md:text-left">
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Success Rate</span>
                            <span className="text-base font-black text-emerald-600">
                              {totalCount > 0 ? `${successRate.toFixed(0)}%` : 'N/A'}
                            </span>
                          </div>

                          <div className="border-l border-gray-100 pl-3">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Avg. Time</span>
                            <span className="text-base font-black text-blue-900">
                              {totalCount > 0 ? `${avgTime.toFixed(1)}s` : 'N/A'}
                            </span>
                          </div>

                          <div className="border-l border-gray-100 pl-3">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Avg. Difficulty</span>
                            <span className="text-base font-black text-purple-900">
                              {totalCount > 0 ? `${avgDiff.toFixed(1)} / 5` : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* List Table */}
            <div className="bg-white border border-gray-200 rounded-[12px] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                {submissions.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 font-medium">
                    No submissions matching this listing round yet.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-bold uppercase tracking-wider">
                        <th className="p-4">Tester Name</th>
                        <th className="p-4">Assigned Variant</th>
                        <th className="p-4">Submitted At</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                      {submissions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4 font-bold text-gray-900">{sub.profiles?.full_name || 'Anonymous Tester'}</td>
                          <td className="p-4">
                            {sub.assigned_variant_id ? (
                              <span className="px-2 py-1 rounded bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-100">
                                Variant {sub.assigned_variant_id}
                              </span>
                            ) : (
                              <span className="text-gray-400">None</span>
                            )}
                          </td>
                          <td className="p-4 text-gray-500">
                            {sub.submitted_at ? formatDate(sub.submitted_at) : 'In Progress'}
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold text-slate-700 bg-slate-100/90 border border-slate-200/80 shadow-2xs font-mono uppercase">
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                sub.status === 'approved'
                                  ? 'bg-emerald-500'
                                  : sub.status === 'rejected'
                                  ? 'bg-rose-500'
                                  : 'bg-amber-500'
                              } shrink-0`} />
                              {sub.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <Link
                              href={`/dashboard/poster/listings/${id}/submissions/${sub.id}`}
                              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
                            >
                              Review Round <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Contents: A/B Comparative Testing Analytics */}
        {activeTab === 'comparative' && listing.variants && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4 mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
                <BarChart3 className="w-5 h-5 text-purple-500" /> A/B Conversion & Usability Comparison
              </h2>
              <p className="text-xs text-gray-400">Metrics are calculated from tester tasks completed per assigned variant routing.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {listing.variants.map((v) => {
                const metrics = getVariantMetrics(v.id);
                return (
                  <div key={v.id} className="bg-white border border-gray-200 rounded-[12px] p-6 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <div>
                        <h3 className="font-extrabold text-lg text-gray-900">{v.title}</h3>
                        <span className="text-[10px] text-gray-400 font-mono truncate block max-w-xs">{v.url}</span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100/90 text-slate-700 text-xs font-semibold border border-slate-200/80 shadow-2xs font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                        Weight: {v.weight}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-[8px] border border-gray-100/50">
                        <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Completed Reviews</span>
                        <span className="text-2xl font-black text-gray-800 mt-1 block">{metrics.completions}</span>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-[8px] border border-gray-100/50">
                        <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Task Success Rate</span>
                        <span className="text-2xl font-black text-emerald-600 mt-1 block">{metrics.successRate.toFixed(0)}%</span>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-[8px] border border-gray-100/50">
                        <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Avg Time-on-Task</span>
                        <span className="text-2xl font-black text-gray-800 mt-1 block">{metrics.avgTime.toFixed(1)}s</span>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-[8px] border border-gray-100/50">
                        <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Usability Friction Rating</span>
                        <span className="text-2xl font-black text-purple-800 mt-1 block">{metrics.avgDiff.toFixed(1)} / 5</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Contents: Heatmap canvas rendering */}
        {activeTab === 'heatmap' && timedTaskScreenshotUrl && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4 mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
                <Eye className="w-5 h-5 text-rose-500" /> First-Click Heatmap (5-Second Visual Recall)
              </h2>
              <p className="text-xs text-gray-400">Heatspots show where testers clicked first when displayed the design layout screenshot.</p>
            </div>

            <div className="bg-gray-900 rounded-[12px] p-6 flex justify-center items-center overflow-hidden border border-gray-800 shadow-inner">
              <div
                ref={containerRef}
                className="relative max-w-full max-h-[70vh] border border-white/10 rounded-lg overflow-hidden shadow-2xl bg-black"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={timedTaskScreenshotUrl}
                  alt="Heatmap design background"
                  className="max-w-full max-h-[70vh] object-contain select-none opacity-90"
                  draggable={false}
                  onLoad={(e) => {
                    const img = e.currentTarget
                    if (canvasRef.current) {
                      canvasRef.current.width = img.clientWidth
                      canvasRef.current.height = img.clientHeight
                    }
                    setImageLoaded(true)
                  }}
                />
                
                {imageLoaded && (
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 z-10 pointer-events-none"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Contents: Version Benchmarking */}
        {activeTab === 'benchmarks' && parentListing && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4 mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
                <TrendingUp className="w-5 h-5 text-emerald-500" /> Version Iteration Benchmarking
              </h2>
              <p className="text-xs text-gray-400">Compare metrics between version rounds to verify design changes and usability gains.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Task Success Rates comparison card */}
              <div className="bg-white border border-gray-200 rounded-[12px] p-6 shadow-sm space-y-4">
                <h3 className="font-extrabold text-sm text-gray-700">Completion Success Rate Comparison</h3>
                
                <div className="space-y-6 pt-4">
                  {/* Parent Round */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1.5">
                      <span className="text-gray-500">v1: {parentListing.title}</span>
                      {(() => {
                        const pct = parentResponses.length > 0
                          ? (parentResponses.filter(r => r.completed_successfully).length / parentResponses.length) * 100
                          : 0
                        return (
                          <span className="text-gray-800">{pct.toFixed(0)}%</span>
                        )
                      })()}
                    </div>
                    <div className="w-full bg-gray-100 h-3.5 rounded-full overflow-hidden">
                      <div
                        style={{
                          width: `${
                            parentResponses.length > 0
                              ? (parentResponses.filter(r => r.completed_successfully).length / parentResponses.length) * 100
                              : 0
                          }%`
                        }}
                        className="bg-gray-400 h-full rounded-full"
                      />
                    </div>
                  </div>

                  {/* Current Round */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1.5">
                      <span className="text-emerald-600">v2 (Current): {listing.title}</span>
                      {(() => {
                        const pct = responses.length > 0
                          ? (responses.filter(r => r.completed_successfully).length / responses.length) * 100
                          : 0
                        return (
                          <span className="text-emerald-700">{pct.toFixed(0)}%</span>
                        )
                      })()}
                    </div>
                    <div className="w-full bg-gray-100 h-3.5 rounded-full overflow-hidden">
                      <div
                        style={{
                          width: `${
                            responses.length > 0
                              ? (responses.filter(r => r.completed_successfully).length / responses.length) * 100
                              : 0
                          }%`
                        }}
                        className="bg-emerald-600 h-full rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Time on task / task complexity card */}
              <div className="bg-white border border-gray-200 rounded-[12px] p-6 shadow-sm space-y-4">
                <h3 className="font-extrabold text-sm text-gray-700">Average Task Duration (Smaller is better)</h3>
                
                <div className="space-y-6 pt-4">
                  {/* Parent Round */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1.5">
                      <span className="text-gray-500">v1: {parentListing.title}</span>
                      {(() => {
                        const avg = parentResponses.length > 0
                          ? parentResponses.reduce((sum, r) => sum + r.time_on_task_seconds, 0) / parentResponses.length
                          : 0
                        return <span className="text-gray-800">{avg.toFixed(1)}s</span>
                      })()}
                    </div>
                    <div className="w-full bg-gray-100 h-3.5 rounded-full overflow-hidden">
                      <div
                        style={{
                          width: `${Math.min(
                            100,
                            parentResponses.length > 0
                              ? (parentResponses.reduce((sum, r) => sum + r.time_on_task_seconds, 0) / parentResponses.length)
                              : 0
                          )}%`
                        }}
                        className="bg-gray-400 h-full rounded-full"
                      />
                    </div>
                  </div>

                  {/* Current Round */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1.5">
                      <span className="text-emerald-600">v2 (Current): {listing.title}</span>
                      {(() => {
                        const avg = responses.length > 0
                          ? responses.reduce((sum, r) => sum + r.time_on_task_seconds, 0) / responses.length
                          : 0
                        return <span className="text-emerald-700">{avg.toFixed(1)}s</span>
                      })()}
                    </div>
                    <div className="w-full bg-gray-100 h-3.5 rounded-full overflow-hidden">
                      <div
                        style={{
                          width: `${Math.min(
                            100,
                            responses.length > 0
                              ? (responses.reduce((sum, r) => sum + r.time_on_task_seconds, 0) / responses.length)
                              : 0
                          )}%`
                        }}
                        className="bg-emerald-600 h-full rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
