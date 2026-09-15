'use client'

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  ArrowRight, 
  Play, 
  ChevronRight,
  Sliders
} from 'lucide-react'

export interface ListingFeedItem {
  id: string
  title: string
  description: string | null
  rate_per_tester: number
  slots_count: number
  slots_filled: number
  status: string
}

// Framer Motion Animation Variants
const fadeInUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } 
  }
}

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05
    }
  }
}

export default function Home() {
  const [user, setUser] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(true)
  const [listings, setListings] = useState<ListingFeedItem[]>([])
  const [listingsLoading, setListingsLoading] = useState(true)
  const supabase = createBrowserClient()

  // Interactive ROI Calculator State
  const [calcTestType, setCalcTestType] = useState<'five_second' | 'functional' | 'audit'>('functional')
  const [calcSlots, setCalcSlots] = useState<number>(5)

  useEffect(() => {
    const fetchSessionAndListings = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
      } catch (err) {
        console.error('Session fetch failed on home:', err)
      } finally {
        setLoading(false)
      }

      try {
        const { data } = await supabase
          .from('listings')
          .select('id, title, description, rate_per_tester, slots_count, slots_filled, status')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(6)

        if (data && data.length > 0) {
          setListings(data)
        }
      } catch (err) {
        console.error('Failed to fetch open listings:', err)
      } finally {
        setListingsLoading(false)
      }
    }

    fetchSessionAndListings()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  // Calculator calculations
  const calcMetrics = useMemo(() => {
    let ratePerSlot = 350
    let avgHours = '1 – 2 hours'
    let outputType = 'Video Screen Recording + Step Checklist + Bug Log'

    if (calcTestType === 'five_second') {
      ratePerSlot = 100
      avgHours = '30 – 45 mins'
      outputType = 'Visual Impression Cloud + Memory Recall + First Click'
    } else if (calcTestType === 'audit') {
      ratePerSlot = 1200
      avgHours = '3 – 4 hours'
      outputType = 'Deep Multi-Device Audio Video + Full Bug Markdown'
    }

    const totalEscrow = ratePerSlot * calcSlots
    const agencyCostEquiv = Math.max(15000, calcSlots * 1800)
    const savedAmount = Math.max(0, agencyCostEquiv - totalEscrow)

    return {
      ratePerSlot,
      totalEscrow,
      agencyCostEquiv,
      savedAmount,
      avgHours,
      outputType
    }
  }, [calcTestType, calcSlots])

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': 'subukAn Active Testing Bounties',
    'description': 'Live marketplace feed of open software user testing and QA tasks in the Philippines.',
    'itemListElement': listings.map((listing, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'item': {
        '@type': 'Offer',
        'name': listing.title,
        'description': listing.description || '',
        'price': listing.rate_per_tester,
        'priceCurrency': 'PHP',
        'availability': 'https://schema.org/InStock',
        'url': `https://subukan.ph/auth/login?role=tester`,
      }
    }))
  }

  return (
    <div className="flex-1 flex flex-col bg-white text-slate-900 selection:bg-blue-100 selection:text-[#2955E3]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      {/* Navigation Header */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center">
              <img src="/subukanlogoweb.png" alt="subukAn Logo" className="h-10 w-auto object-contain" />
            </Link>
            <nav className="hidden lg:flex items-center space-x-6 text-xs font-semibold text-slate-600">
              <a href="#solutions" className="hover:text-slate-900 transition-colors">Solutions</a>
              <a href="#device-matrix" className="hover:text-slate-900 transition-colors">PH Device Matrix</a>
              <a href="#roi-calculator" className="hover:text-slate-900 transition-colors">Escrow Calculator</a>
              <a href="#why-subukan" className="hover:text-slate-900 transition-colors">ROI Comparison</a>
              <a href="#compliance" className="hover:text-slate-900 transition-colors">Security &amp; Legal</a>
            </nav>
          </div>

          <div className="flex items-center space-x-3">
            {!loading && (
              <>
                {!user ? (
                  <>
                    <Link 
                      href="/auth/login" 
                      className="px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
                    >
                      Sign In
                    </Link>
                    <Link 
                      href="/auth/login?role=poster" 
                      className="px-4 py-2 bg-[#2955E3] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 active:scale-[0.98]"
                    >
                      <span>Post a Campaign</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </>
                ) : (
                  <>
                    <Link 
                      href="/dashboard" 
                      className="px-4 py-2 bg-[#2955E3] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <span>Go to Dashboard</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <button 
                      onClick={handleLogout}
                      className="px-3.5 py-1.5 border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg transition-all"
                    >
                      Log Out
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 bg-gradient-to-b from-slate-50/70 via-white to-white border-b border-slate-200/70 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="text-center max-w-3xl mx-auto mb-12"
          >
            <motion.h1 
              variants={fadeInUp}
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-6"
            >
              Ship Flawless Software to Filipino Users.
            </motion.h1>

            <motion.p 
              variants={fadeInUp}
              className="text-base sm:text-lg md:text-xl text-slate-600 leading-relaxed mb-8 max-w-2xl mx-auto"
            >
              On-demand usability testing and bug verification on real Philippine mobile devices, live cellular data (<span className="font-semibold text-slate-800">Globe, Smart, DITO</span>), and authentic e-wallets (<span className="font-semibold text-slate-800">GCash, Maya</span>). Results in under 2 hours — backed by NDA and escrow protection.
            </motion.p>

            <motion.div 
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-3.5"
            >
              {!loading && (
                <>
                  {!user ? (
                    <>
                      <Link 
                        href="/auth/login?role=poster" 
                        className="w-full sm:w-auto px-8 py-3.5 bg-[#2955E3] hover:bg-[#1D4ED8] text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 group active:scale-[0.98]"
                      >
                        <span>Launch a Test Campaign</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                      <a 
                        href="#roi-calculator" 
                        className="w-full sm:w-auto px-6 py-3.5 border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 bg-white font-bold rounded-xl text-sm transition-all hover:bg-slate-50 flex items-center justify-center gap-2 shadow-2xs"
                      >
                        <Sliders className="w-4 h-4 text-slate-500" />
                        <span>Calculate Campaign Cost</span>
                      </a>
                    </>
                  ) : (
                    <Link 
                      href="/dashboard" 
                      className="w-full sm:w-auto px-10 py-3.5 bg-[#2955E3] hover:bg-[#1D4ED8] text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <span>Open Poster Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </>
              )}
            </motion.div>

            <motion.div 
              variants={fadeInUp}
              className="mt-5 text-xs text-slate-500 flex items-center justify-center gap-2"
            >
              <span>Looking to earn as a tester?</span>
              <Link href="/auth/login?role=tester" className="text-[#2955E3] font-bold hover:underline">
                Join our QA Tester Pool →
              </Link>
            </motion.div>
          </motion.div>

          {/* Product Intelligence Mockup */}
          <motion.div 
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-4xl mx-auto mt-10 rounded-2xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden"
          >
            {/* Window Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                <span className="ml-2 font-mono text-slate-400 text-[11px]">subukan-qa-report-session-8821.mp4</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                <span>1080p QA Capture</span>
              </div>
            </div>

            {/* Mock Dashboard Content */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50/50">
              {/* Video Player Preview */}
              <div className="md:col-span-7 bg-slate-900 rounded-xl overflow-hidden relative shadow-inner aspect-video flex flex-col justify-between p-4 text-white">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span className="text-[10px]">Mobile Screen + Audio</span>
                  <span className="text-[10px]">01:42 / 03:15</span>
                </div>

                <div className="text-center my-auto">
                  <div className="w-12 h-12 rounded-full bg-[#2955E3] text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-900/50 cursor-pointer hover:scale-105 transition-transform">
                    <Play className="w-5 h-5 ml-0.5 fill-white" />
                  </div>
                  <span className="text-xs text-slate-300 mt-2 block font-medium">Task: E-Commerce GCash Checkout Flow</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="text-amber-400 font-semibold">00:48 — GCash Modal Latency Warning</span>
                    <span>1080p • 60fps</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#2955E3] h-full w-[54%]"></div>
                  </div>
                </div>
              </div>

              {/* Structured Metadata & Bug Log */}
              <div className="md:col-span-5 flex flex-col justify-between space-y-4 text-xs">
                <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    Tester Hardware Profile
                  </div>
                  <div className="space-y-2 text-slate-700">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <span className="text-slate-500 font-mono">Device:</span>
                      <span className="font-semibold text-slate-900">Samsung Galaxy A14</span>
                    </div>
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <span className="text-slate-500 font-mono">OS / Engine:</span>
                      <span className="font-semibold text-slate-900">Android 13 • Chrome 124</span>
                    </div>
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <span className="text-slate-500 font-mono">Carrier Network:</span>
                      <span className="font-semibold text-slate-900">Smart Communications 5G</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-mono">Payment Test:</span>
                      <span className="font-semibold text-emerald-600 font-mono">GCash QR (Simulated)</span>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3.5">
                  <div className="text-emerald-900 font-bold text-xs">
                    Quality Acceptance Passed
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-1 leading-relaxed">
                    Tester completed all 4 steps, flagged a 1.8s modal delay on 4G, and submitted full audio commentary.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust, Security & Compliance Bar */}
      <section id="compliance" className="border-b border-slate-200/80 bg-slate-50 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={staggerContainer}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            <motion.div variants={fadeInUp} className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
              <h4 className="font-extrabold text-sm text-slate-900">100% NDA Protected</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Legally binding master confidentiality agreements before any tester accesses your staging environment.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
              <h4 className="font-extrabold text-sm text-slate-900">Real PH Device Matrix</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Zero emulators. Tests run on genuine Filipino Android and iOS handsets with Globe, Smart, &amp; DITO data.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
              <h4 className="font-extrabold text-sm text-slate-900">NPC RA 10173 Compliant</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Strict Data Privacy Act compliance with temporary signed tokens and sensitive information screening.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
              <h4 className="font-extrabold text-sm text-slate-900">BIR RR 16-2023 Invoicing</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tax-compliant company spend receipts itemizing escrow allocations with registered TIN numbers.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Core Business Solutions */}
      <section id="solutions" className="py-20 bg-white border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Designed for High-Velocity Product Teams
            </h2>
            <p className="text-sm text-slate-600">
              Select the exact depth of validation you need at every stage of your development cycle.
            </p>
          </div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {/* Solution 1 */}
            <motion.div variants={fadeInUp} className="p-8 rounded-2xl border border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:shadow-lg transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-900">5-Second Impression Tests</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Test wireframes, value propositions, and landing pages. Discover what users understand in the first 5 seconds before spending ad budget.
                </p>
                <div className="pt-4 border-t border-slate-200/80 space-y-2 text-xs text-slate-700">
                  <div className="flex items-start gap-2">
                    <span className="text-[#2955E3] font-bold">•</span>
                    <span>Visual comprehension word clouds</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#2955E3] font-bold">•</span>
                    <span>First-click heatmaps and attention tracking</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#2955E3] font-bold">•</span>
                    <span>Completed in under 30 minutes</span>
                  </div>
                </div>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-200">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Starting Rate</div>
                <div className="text-2xl font-extrabold text-slate-900 font-mono">₱50 – ₱150 <span className="text-xs font-normal text-slate-500 font-sans">/ tester</span></div>
              </div>
            </motion.div>

            {/* Solution 2 */}
            <motion.div variants={fadeInUp} className="p-8 rounded-2xl border border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:shadow-lg transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-900">Fintech &amp; Checkout Walks</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Verify multi-step conversion funnels, signup flows, KYC submissions, and live GCash, Maya, or QR Ph checkout integrations.
                </p>
                <div className="pt-4 border-t border-slate-200/80 space-y-2 text-xs text-slate-700">
                  <div className="flex items-start gap-2">
                    <span className="text-[#2955E3] font-bold">•</span>
                    <span>Full HD screen recording with audio commentary</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#2955E3] font-bold">•</span>
                    <span>Step-by-step pass/fail verification</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#2955E3] font-bold">•</span>
                    <span>Real carrier network latency checks</span>
                  </div>
                </div>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-200">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Starting Rate</div>
                <div className="text-2xl font-extrabold text-[#2955E3] font-mono">₱200 – ₱500 <span className="text-xs font-normal text-slate-500 font-sans">/ tester</span></div>
              </div>
            </motion.div>

            {/* Solution 3 */}
            <motion.div variants={fadeInUp} className="p-8 rounded-2xl border border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:shadow-lg transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-900">Deep Usability &amp; QA Audits</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Comprehensive exploratory testing across diverse Philippine hardware brands (Transsion, Xiaomi, Samsung) with full markdown bug reports.
                </p>
                <div className="pt-4 border-t border-slate-200/80 space-y-2 text-xs text-slate-700">
                  <div className="flex items-start gap-2">
                    <span className="text-[#2955E3] font-bold">•</span>
                    <span>Multi-device regression matrix</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#2955E3] font-bold">•</span>
                    <span>Jira/GitHub-ready markdown bug logs</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#2955E3] font-bold">•</span>
                    <span>Senior Level 3 verified QA specialists</span>
                  </div>
                </div>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-200">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Starting Rate</div>
                <div className="text-2xl font-extrabold text-slate-900 font-mono">₱1,000+ <span className="text-xs font-normal text-slate-500 font-sans">/ tester</span></div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Real Device & Carrier Network Matrix (With Official Brand Logos) */}
      <section id="device-matrix" className="py-20 bg-slate-50 border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Test on the Real Philippine Mobile Matrix
            </h2>
            <p className="text-sm text-slate-600">
              80%+ of Filipino digital consumers browse on affordable Android chipsets and fluctuating mobile cellular data. Emulators miss real-world bugs. SubukAn catches them.
            </p>
          </div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* Device Coverage Card */}
            <motion.div variants={fadeInUp} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900">Real Hardware Brands</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Real hardware testing across low, mid, and flagship handsets:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-800">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center gap-2.5">
                  <div className="flex items-center gap-1 shrink-0">
                    <img src="/logos/tecno.svg" alt="Tecno" className="h-3.5 w-auto object-contain max-w-[28px]" />
                    <span className="text-slate-300">/</span>
                    <img src="/logos/infinix.svg" alt="Infinix" className="h-3.5 w-auto object-contain max-w-[28px]" />
                  </div>
                  <span className="truncate font-semibold text-slate-900">Tecno &amp; Infinix</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center gap-2.5">
                  <img src="/logos/xiaomi.svg" alt="Xiaomi" className="h-4 w-4 shrink-0 object-contain rounded-[3px]" />
                  <span className="truncate font-semibold text-slate-900">Xiaomi &amp; Redmi</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center gap-2.5">
                  <div className="flex items-center gap-1 shrink-0">
                    <img src="/logos/realme.svg" alt="Realme" className="h-3.5 w-auto object-contain max-w-[32px]" />
                    <span className="text-slate-300">/</span>
                    <img src="/logos/oppo.svg" alt="OPPO" className="h-3.5 w-auto object-contain max-w-[28px]" />
                  </div>
                  <span className="truncate font-semibold text-slate-900">Realme &amp; Oppo</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center gap-2.5">
                  <img src="/logos/samsung.svg" alt="Samsung" className="h-3.5 w-auto object-contain max-w-[45px]" />
                  <span className="truncate font-semibold text-slate-900">Galaxy Series</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center gap-2.5">
                  <div className="flex items-center gap-1 shrink-0">
                    <img src="/logos/vivo.svg" alt="vivo" className="h-3.5 w-auto object-contain max-w-[28px]" />
                    <span className="text-slate-300">/</span>
                    <img src="/logos/huawei.svg" alt="Huawei" className="h-4 w-4 object-contain shrink-0" />
                  </div>
                  <span className="truncate font-semibold text-slate-900">Vivo &amp; Huawei</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center gap-2.5">
                  <img src="/logos/apple.svg" alt="Apple" className="h-4 w-4 shrink-0 object-contain" />
                  <span className="truncate font-semibold text-slate-900">Apple iPhone</span>
                </div>
              </div>
            </motion.div>

            {/* Carrier Network Card */}
            <motion.div variants={fadeInUp} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900">PH Carrier Networks</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Test real latency, network reconnects, and CDN routing on local carriers:
              </p>
              <div className="space-y-2 text-xs font-medium text-slate-800">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img src="/logos/globe.svg" alt="Globe Telecom" className="h-5 w-auto object-contain max-w-[52px] shrink-0" />
                    <span className="font-semibold text-slate-900">Globe Telecom</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">4G LTE / 5G</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img src="/logos/smart.svg" alt="Smart Communications" className="h-5 w-auto object-contain max-w-[48px] shrink-0" />
                    <span className="font-semibold text-slate-900">Smart Communications</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">4G LTE / 5G</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img src="/logos/dito.svg" alt="DITO Telecommunity" className="h-4 w-auto object-contain max-w-[48px] shrink-0" />
                    <span className="font-semibold text-slate-900">DITO Telecommunity</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">Pure 4G / 5G</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img src="/logos/pldt.svg" alt="PLDT" className="h-4 w-auto object-contain max-w-[40px] shrink-0" />
                    <span className="text-slate-300">/</span>
                    <img src="/logos/converge.svg" alt="Converge" className="h-4 w-auto object-contain max-w-[40px] shrink-0" />
                    <span className="font-semibold text-slate-900">PLDT &amp; Converge</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">Fiber Wi-Fi</span>
                </div>
              </div>
            </motion.div>

            {/* Local Fintech Instruments */}
            <motion.div variants={fadeInUp} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900">PH Payment Methods</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Validate real checkout redirects and webhooks with active Philippine wallets:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-800">
                <div className="p-2.5 bg-blue-50/40 rounded-lg border border-blue-200/80 flex items-center gap-2.5">
                  <img src="/logos/gcash.svg" alt="GCash" className="h-4 w-auto object-contain max-w-[48px] shrink-0" />
                  <span className="font-bold text-[#007DFE]">GCash</span>
                </div>

                <div className="p-2.5 bg-emerald-50/40 rounded-lg border border-emerald-200/80 flex items-center gap-2.5">
                  <img src="/logos/maya.svg" alt="Maya" className="h-3.5 w-auto object-contain max-w-[40px] shrink-0" />
                  <span className="font-bold text-slate-900">Maya</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center gap-2.5">
                  <img src="/logos/qrph.svg" alt="QR Ph" className="h-4 w-auto object-contain max-w-[40px] shrink-0" />
                  <span className="font-semibold text-slate-900">QR Ph</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center gap-2.5">
                  <img src="/logos/grab.svg" alt="GrabPay" className="h-3.5 w-auto object-contain max-w-[36px] shrink-0" />
                  <span className="font-semibold text-slate-900">GrabPay</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center gap-2.5">
                  <img src="/logos/unionbank.svg" alt="UnionBank" className="h-4 w-auto object-contain max-w-[42px] shrink-0" />
                  <span className="font-semibold text-slate-900">UnionBank</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center gap-2">
                  <img src="/logos/visa.svg" alt="Visa" className="h-3 w-auto object-contain max-w-[28px] shrink-0" />
                  <span className="text-slate-300">/</span>
                  <img src="/logos/mastercard.svg" alt="Mastercard" className="h-3.5 w-auto object-contain max-w-[24px] shrink-0" />
                  <span className="font-semibold text-slate-900">Cards</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ROI & Business Comparison Matrix */}
      <section id="why-subukan" className="py-20 bg-white border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Why High-Growth Teams Choose SubukAn
            </h2>
            <p className="text-sm text-slate-600">
              Eliminate slow manual testing cycles and expensive overseas SaaS software.
            </p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                    <th className="py-4 px-6">Core Evaluation Metric</th>
                    <th className="py-4 px-6 text-slate-500">In-House QA / Local Agencies</th>
                    <th className="py-4 px-6 text-slate-500">Overseas Platforms (UserTesting)</th>
                    <th className="py-4 px-6 text-[#2955E3] bg-blue-50/60">subukAn Platform</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  <tr>
                    <td className="py-4 px-6 font-bold text-slate-900">Turnaround Velocity</td>
                    <td className="py-4 px-6 text-slate-500">1 to 3 Weeks</td>
                    <td className="py-4 px-6 text-slate-500">24 to 48 Hours</td>
                    <td className="py-4 px-6 font-bold text-[#2955E3] bg-blue-50/40">30 Mins to 2 Hours</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-bold text-slate-900">Local PH Payment Testing</td>
                    <td className="py-4 px-6 text-slate-500">Manual &amp; difficult to coordinate</td>
                    <td className="py-4 px-6 text-slate-500">No localized testers</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 bg-blue-50/40">Native GCash, Maya, QR Ph</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-bold text-slate-900">Real Device Hardware</td>
                    <td className="py-4 px-6 text-slate-500">Limited office device inventory</td>
                    <td className="py-4 px-6 text-slate-500">Western flagships only</td>
                    <td className="py-4 px-6 font-bold text-[#2955E3] bg-blue-50/40">Real PH Android &amp; iOS fleet</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-bold text-slate-900">Pricing &amp; Commitment</td>
                    <td className="py-4 px-6 text-slate-500">₱60k – ₱150k monthly retainer</td>
                    <td className="py-4 px-6 text-slate-500">$15,000+ USD annual contract</td>
                    <td className="py-4 px-6 font-bold text-[#2955E3] bg-blue-50/40">Pay-as-you-go per slot (₱150+)</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-bold text-slate-900">Escrow &amp; Dispute Protection</td>
                    <td className="py-4 px-6 text-slate-500">Fixed billing, no refunds</td>
                    <td className="py-4 px-6 text-slate-500">Non-refundable subscription</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 bg-blue-50/40">72h auto-release &amp; refunds</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-bold text-slate-900">Enterprise Legal Security</td>
                    <td className="py-4 px-6 text-slate-500">Custom contract negotiation</td>
                    <td className="py-4 px-6 text-slate-500">Standard US Terms</td>
                    <td className="py-4 px-6 font-bold text-slate-900 bg-blue-50/40">NPC DPA + Built-in Tester NDAs</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Interactive Campaign Escrow Calculator */}
      <section id="roi-calculator" className="py-20 bg-slate-50 border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Interactive Campaign Escrow Calculator
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Calculate your exact escrow allocation. Zero recurring subscription commitments.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-8">
            {/* Step 1: Select Test Type */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                1. Select Validation Depth
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setCalcTestType('five_second')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    calcTestType === 'five_second'
                      ? 'border-[#2955E3] bg-blue-50/50 ring-2 ring-blue-600/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900 mb-1">5-Second Impression</div>
                  <div className="text-[11px] text-slate-500 font-mono">₱100 / verified slot</div>
                </button>

                <button
                  type="button"
                  onClick={() => setCalcTestType('functional')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    calcTestType === 'functional'
                      ? 'border-[#2955E3] bg-blue-50/50 ring-2 ring-blue-600/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900 mb-1">Functional &amp; Checkout Walk</div>
                  <div className="text-[11px] text-slate-500 font-mono">₱350 / verified slot</div>
                </button>

                <button
                  type="button"
                  onClick={() => setCalcTestType('audit')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    calcTestType === 'audit'
                      ? 'border-[#2955E3] bg-blue-50/50 ring-2 ring-blue-600/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900 mb-1">Deep Usability Audit</div>
                  <div className="text-[11px] text-slate-500 font-mono">₱1,200 / verified slot</div>
                </button>
              </div>
            </div>

            {/* Step 2: Slider for Slots */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Number of Verified Testers
                </label>
                <span className="text-sm font-extrabold text-[#2955E3] font-mono">
                  {calcSlots} {calcSlots === 1 ? 'Tester Slot' : 'Tester Slots'}
                </span>
              </div>
              <input
                type="range"
                min="3"
                max="30"
                step="1"
                value={calcSlots}
                onChange={(e) => setCalcSlots(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#2955E3]"
              />
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>3 slots (Quick sample)</span>
                <span>15 slots (Standard cohort)</span>
                <span>30 slots (Comprehensive QA)</span>
              </div>
            </div>

            {/* Step 3: Breakdown Card with Framer Motion AnimatePresence */}
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estimated Escrow Total</div>
                  <AnimatePresence mode="wait">
                    <motion.div 
                      key={calcMetrics.totalEscrow}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="text-3xl font-extrabold text-slate-900 font-mono"
                    >
                      ₱{calcMetrics.totalEscrow.toLocaleString()}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="text-left sm:text-right space-y-1">
                  <div className="text-xs font-semibold text-emerald-600 font-mono">
                    Save ~₱{calcMetrics.savedAmount.toLocaleString()} vs Agencies
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Est. Turnaround: <span className="font-semibold text-slate-800">{calcMetrics.avgHours}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Deliverables:</span>
                  <span className="font-semibold text-slate-800 text-right">{calcMetrics.outputType}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Escrow Protection Window:</span>
                  <span className="font-semibold text-slate-800">72-Hour Full Review &amp; Approval Period</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Accounting &amp; Tax:</span>
                  <span className="font-semibold text-slate-800">Official BIR Itemized Spend Receipt Included</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/auth/login?role=poster"
                  className="w-full py-3 bg-[#2955E3] hover:bg-[#1D4ED8] text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <span>Fund &amp; Launch This Campaign (₱{calcMetrics.totalEscrow.toLocaleString()})</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Available Test Tasks Feed Section */}
      <section id="available-tasks" className="py-20 bg-white border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Active Testing Opportunities</h2>
              <p className="text-slate-500 text-sm mt-1">
                Real campaigns funded in escrow and currently being tested on Philippine devices.
              </p>
            </div>
            <Link
              href="/auth/login?role=tester"
              className="mt-4 md:mt-0 text-sm font-bold text-[#2955E3] hover:underline flex items-center gap-1"
            >
              <span>View all tester tasks</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {listingsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-slate-200 rounded-2xl p-6 bg-slate-50 animate-pulse h-52 flex flex-col justify-between">
                  <div>
                    <div className="h-5 bg-slate-200 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
                    <div className="h-4 bg-slate-200 rounded w-2/3 mb-4"></div>
                  </div>
                  <div className="h-9 bg-slate-200 rounded w-full"></div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="border border-slate-200 rounded-2xl p-12 bg-white text-center max-w-lg mx-auto shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">No Open Tasks Right Now</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  New testing opportunities appear as creators launch campaigns. Post your own campaign to get feedback immediately!
                </p>
              </div>
              <div>
                <Link
                  href="/auth/login?role=poster"
                  className="inline-flex items-center px-6 py-2.5 bg-[#2955E3] hover:bg-[#1D4ED8] text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-sm"
                >
                  Post a Test Campaign
                </Link>
              </div>
            </div>
          ) : (
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {listings.map((listing) => {
                const slotsLeft = Math.max(0, (listing.slots_count || 0) - (listing.slots_filled || 0))
                return (
                  <motion.div 
                    variants={fadeInUp}
                    key={listing.id}
                    className="border border-slate-200 rounded-2xl p-6 bg-white flex flex-col justify-between shadow-2xs hover:shadow-md hover:border-slate-300 transition-all group"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-3 font-mono">
                        <span className="font-semibold text-slate-700">Open Bounty</span>
                        <span>{slotsLeft} {slotsLeft === 1 ? 'slot' : 'slots'} left</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mb-2 group-hover:text-[#2955E3] transition-colors line-clamp-1">
                        {listing.title}
                      </h3>
                      <p className="text-slate-500 text-xs mb-6 line-clamp-2 leading-relaxed">
                        {listing.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider">Escrow Bounty</span>
                        <span className="text-lg font-extrabold text-slate-900 font-mono">
                          ₱{listing.rate_per_tester?.toLocaleString() ?? 0}
                        </span>
                      </div>
                      <Link
                        href="/auth/login?role=tester"
                        className="w-full text-center py-2.5 bg-slate-900 hover:bg-[#2955E3] text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <span>Claim Slot &amp; Start Test</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="py-20 bg-slate-50 border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">Frequently Asked Questions</h2>
            <p className="text-slate-600 text-sm max-w-xl mx-auto">
              Clear, factual answers regarding Philippine crowd-QA, escrow security, NDAs, and payment mechanisms.
            </p>
          </div>

          <div className="space-y-4">
            <details className="group border border-slate-200 rounded-2xl bg-white p-6 [&_summary::-webkit-details-marker]:hidden transition-all duration-300">
              <summary className="flex items-center justify-between cursor-pointer focus:outline-none">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#2955E3] transition-colors">
                  How does subukAn guarantee tester confidentiality and NDA protection?
                </h3>
                <span className="ml-1.5 shrink-0 text-slate-400 group-open:rotate-90 transition-transform">
                  <ChevronRight className="w-4 h-4" />
                </span>
              </summary>
              <div className="mt-4 text-xs text-slate-600 border-t border-slate-100 pt-4 leading-relaxed space-y-2">
                <p className="font-semibold text-slate-900">
                  Every tester on subukAn agrees to a legally binding Master Non-Disclosure Agreement (NDA) before viewing test instructions or staging URLs.
                </p>
                <p>
                  Testers are strictly prohibited from distributing screenshots, videos, or product details outside the review portal. Submissions are watermarked and stored in encrypted storage accessible only to your account.
                </p>
              </div>
            </details>

            <details className="group border border-slate-200 rounded-2xl bg-white p-6 [&_summary::-webkit-details-marker]:hidden transition-all duration-300">
              <summary className="flex items-center justify-between cursor-pointer focus:outline-none">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#2955E3] transition-colors">
                  How does the Escrow and 72-Hour Auto-Release mechanism work?
                </h3>
                <span className="ml-1.5 shrink-0 text-slate-400 group-open:rotate-90 transition-transform">
                  <ChevronRight className="w-4 h-4" />
                </span>
              </summary>
              <div className="mt-4 text-xs text-slate-600 border-t border-slate-100 pt-4 leading-relaxed space-y-2">
                <p className="font-semibold text-slate-900">
                  When you create a campaign, your budget is held safely in escrow through PayMongo.
                </p>
                <p>
                  Once a tester submits their proof (video recording, bug log, checklist), you have a full 72-hour review window to approve, reject, or request revisions. If you do not take action within 72 hours, the platform auto-releases the bounty to protect tester effort. If you cancel unfilled slots, your funds are returned automatically.
                </p>
              </div>
            </details>

            <details className="group border border-slate-200 rounded-2xl bg-white p-6 [&_summary::-webkit-details-marker]:hidden transition-all duration-300">
              <summary className="flex items-center justify-between cursor-pointer focus:outline-none">
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#2955E3] transition-colors">
                  Can we receive official BIR-compliant receipts and tax invoices?
                </h3>
                <span className="ml-1.5 shrink-0 text-slate-400 group-open:rotate-90 transition-transform">
                  <ChevronRight className="w-4 h-4" />
                </span>
              </summary>
              <div className="mt-4 text-xs text-slate-600 border-t border-slate-100 pt-4 leading-relaxed space-y-2">
                <p className="font-semibold text-slate-900">
                  Yes. In accordance with BIR Revenue Regulations (RR 16-2023), company posters can configure their registered corporate name, address, and TIN in Poster Settings.
                </p>
                <p>
                  Every completed campaign generates a downloadable itemized spend receipt and financial ledger for corporate accounting and tax filing.
                </p>
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* Footer (Option 1: Multi-Column Enterprise Grid) */}
      <footer className="bg-slate-50 border-t border-slate-200/80 pt-16 pb-12">
        <div className="max-w-6xl mx-auto px-6">
          {/* Multi-Column Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-slate-200/80 text-xs">
            {/* Brand Column (Span 2) */}
            <div className="col-span-2 space-y-4">
              <Link href="/" className="flex items-center">
                <img src="/subukanlogoweb.png" alt="subukAn Logo" className="h-9 w-auto object-contain" />
              </Link>
              <p className="text-slate-500 leading-relaxed max-w-sm">
                On-demand usability testing and crowd-QA infrastructure for Philippine digital products. Validated on real Android and iOS handsets, local telecom carriers, and e-wallets.
              </p>
            </div>

            {/* Solutions Column */}
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900 font-mono">Solutions</div>
              <ul className="space-y-2 text-slate-600">
                <li><a href="#solutions" className="hover:text-slate-900 transition-colors">5-Second Impression</a></li>
                <li><a href="#solutions" className="hover:text-slate-900 transition-colors">Fintech &amp; Checkout</a></li>
                <li><a href="#solutions" className="hover:text-slate-900 transition-colors">Deep Usability Audits</a></li>
                <li><a href="#device-matrix" className="hover:text-slate-900 transition-colors">PH Device Matrix</a></li>
                <li><a href="#roi-calculator" className="hover:text-slate-900 transition-colors">Escrow Calculator</a></li>
              </ul>
            </div>

            {/* Portals & Workspaces Column */}
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900 font-mono">Portals</div>
              <ul className="space-y-2 text-slate-600">
                {!loading && user ? (
                  <li><Link href="/dashboard" className="hover:text-slate-900 transition-colors">Go to Dashboard</Link></li>
                ) : (
                  <>
                    <li><Link href="/auth/login?role=poster" className="hover:text-slate-900 transition-colors">Poster Dashboard</Link></li>
                    <li><Link href="/auth/login?role=tester" className="hover:text-slate-900 transition-colors">Tester Hub (Earn GCash)</Link></li>
                    <li><Link href="/auth/login" className="hover:text-slate-900 transition-colors">Portal Sign In</Link></li>
                  </>
                )}
                <li><a href="#available-tasks" className="hover:text-slate-900 transition-colors">Active Bounties Feed</a></li>
              </ul>
            </div>

            {/* Compliance & Legal Column */}
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900 font-mono">Legal &amp; Compliance</div>
              <ul className="space-y-2 text-slate-600">
                <li><Link href="/terms" className="hover:text-slate-900 transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy Policy (DPA)</Link></li>
                <li><Link href="/nda" className="hover:text-slate-900 transition-colors">Tester Master NDA</Link></li>
                <li><Link href="/refund-policy" className="hover:text-slate-900 transition-colors">Refund &amp; Escrow Policy</Link></li>
              </ul>
            </div>
          </div>

          {/* Sub-Footer Baseline Bar */}
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              &copy; {new Date().getFullYear()} subukAn. Engineered by{' '}
              <a href="https://github.com/justpres" target="_blank" rel="noopener noreferrer" className="text-slate-700 font-semibold hover:text-slate-900 transition-colors">
                Justine Lopez (@justpres)
              </a>.
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              NPC RA 10173 • DTI RA 11967 • BIR RR 16-2023
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
