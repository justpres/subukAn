'use client'

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'

export interface ListingFeedItem {
  id: string
  title: string
  description: string | null
  rate_per_tester: number
  slots_count: number
  slots_filled: number
  status: string
}

const DEFAULT_FEED_LISTINGS: ListingFeedItem[] = [
  {
    id: 'feed-1',
    title: 'E-Commerce GCash & Maya Checkout Flow',
    description: 'Verify localized payment gateway response times and check for UI distortion on mobile screens.',
    rate_per_tester: 250,
    slots_count: 5,
    slots_filled: 2,
    status: 'open'
  },
  {
    id: 'feed-2',
    title: 'Rider Delivery App Pin Accuracy Verification',
    description: 'Test real-time GPS location pin updates and map marker rendering across Metro Manila locations.',
    rate_per_tester: 400,
    slots_count: 10,
    slots_filled: 6,
    status: 'open'
  },
  {
    id: 'feed-3',
    title: 'Sari-Sari Store POS Inventory Audit',
    description: 'Perform quick 5-minute impression testing on inventory list search filtering and checkout modal.',
    rate_per_tester: 150,
    slots_count: 8,
    slots_filled: 3,
    status: 'open'
  }
]

export default function Home() {
  const [user, setUser] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(true)
  const [listings, setListings] = useState<ListingFeedItem[]>([])
  const [listingsLoading, setListingsLoading] = useState(true)
  const supabase = createBrowserClient()

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

  return (
    <div className="flex-1 flex flex-col">
      {/* Navigation */}
      <header className="border-b border-steel/30 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/subukanlogoweb.png" alt="subukAn Logo" className="h-12 w-auto object-contain" />
          </div>
          <nav className="hidden md:flex space-x-8 text-sm font-medium text-slate">
            <a href="#how-it-works" className="hover:text-ink transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-ink transition-colors">Pricing Options</a>
            <a href="#benefits" className="hover:text-ink transition-colors">Benefits</a>
            <a href="#status-showcase" className="hover:text-ink transition-colors">Status Tokens</a>
          </nav>
          <div className="flex items-center space-x-3">
            {!loading && (
              <>
                {!user ? (
                  <>
                    <Link 
                      href="/auth/login" 
                      className="px-4 py-2 border border-steel text-sm font-semibold rounded-button text-slate hover:text-ink hover:bg-canvas transition-all"
                    >
                      Log In
                    </Link>
                    <Link 
                      href="/auth/login?role=poster" 
                      className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-button shadow-sm transition-all"
                    >
                      Post a Test
                    </Link>
                  </>
                ) : (
                  <>
                    <Link 
                      href="/dashboard" 
                      className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-button shadow-sm transition-all"
                    >
                      Go to Dashboard
                    </Link>
                    <button 
                      onClick={handleLogout}
                      className="px-4 py-2 border border-steel text-sm font-semibold rounded-button text-slate hover:text-ink hover:bg-canvas transition-all cursor-pointer"
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
      <section className="py-20 md:py-28 bg-white border-b border-steel/20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center space-x-2 bg-tint-open/60 text-tint-open-text text-xs font-semibold px-3 py-1 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-tint-open-text rounded-full animate-pulse"></span>
            <span>Now Live in the Philippines</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-ink tracking-tight leading-tight mb-6">
            Guaranteed QA results.<br />
            Backed by secure escrow.
          </h1>
          <p className="text-lg md:text-xl text-slate max-w-2xl mx-auto mb-10 leading-relaxed">
            subukAn connects tech builders with real local testers. Funds are secured in escrow before testing begins, delivering clean bugs for developers and guaranteed payouts for testers.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {!loading && (
              <>
                {!user ? (
                  <>
                    <Link 
                      href="/auth/login?role=poster" 
                      className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-button text-base transition-all flex items-center justify-center space-x-2"
                    >
                      <span>Build & Deploy Tests</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </Link>
                    <Link 
                      href="/auth/login?role=tester" 
                      className="w-full sm:w-auto px-8 py-4 border border-steel hover:border-slate text-ink bg-white font-bold rounded-button text-base transition-all hover:bg-canvas flex items-center justify-center space-x-2"
                    >
                      <span>Become a Tester</span>
                      <svg className="w-5 h-5 text-slate" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </Link>
                  </>
                ) : (
                  <Link 
                    href="/dashboard" 
                    className="w-full sm:w-auto px-12 py-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-button text-base transition-all flex items-center justify-center space-x-2 shadow-md"
                  >
                    <span>Open Dashboard Workspace</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Conceptual model: Escrow Status Bar Highlight */}
      <section id="how-it-works" className="py-12 bg-canvas border-b border-steel/20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-white border border-steel/40 rounded-card p-6 md:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-steel mb-1">Conceptual Model: Active Escrow Protection</h3>
                <h2 className="text-xl font-bold text-ink mb-2">How subukAn protects your money and time</h2>
                <p className="text-sm text-slate">Funds are committed upfront and auto-locked in escrow. Every step is clearly signaled to both poster and tester.</p>
              </div>
              <div className="flex-1 max-w-md w-full">
                {/* Mock Escrow Status Bar */}
                <div className="border border-steel/30 rounded-button bg-canvas p-4 text-xs">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-ink">GCash Flow Integration Audit</span>
                    <span className="font-semibold text-primary">₱500 held in Escrow</span>
                  </div>
                  {/* Status Steps */}
                  <div className="grid grid-cols-3 gap-2 relative">
                    <div className="text-center p-2 rounded bg-tint-open text-tint-open-text font-semibold border border-tint-open-text/10">
                      1. Reserved
                    </div>
                    <div className="text-center p-2 rounded bg-tint-filling text-tint-filling-text font-semibold border border-tint-filling-text/10">
                      2. Under Review
                    </div>
                    <div className="text-center p-2 rounded bg-tint-released text-tint-released-text font-semibold border border-tint-released-text/10">
                      3. Released
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-slate flex justify-between items-center">
                    <span>3 of 5 testing slots filled</span>
                    <span className="underline cursor-pointer">View Escrow Contract</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Available Test Tasks Feed Section (T1) */}
      <section id="available-tasks" className="py-16 bg-white border-b border-steel/20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
            <div>
              <div className="inline-flex items-center space-x-2 bg-tint-open/60 text-tint-open-text text-xs font-semibold px-3 py-1 rounded-full mb-3">
                <span className="w-1.5 h-1.5 bg-tint-open-text rounded-full animate-pulse"></span>
                <span>Live Marketplace Feed</span>
              </div>
              <h2 className="text-3xl font-extrabold text-ink tracking-tight">Available Test Tasks</h2>
              <p className="text-slate text-sm mt-1">
                Browse open testing slots with pre-funded escrow payouts ready to be claimed.
              </p>
            </div>
            <Link
              href="/auth/login?role=tester"
              className="mt-4 md:mt-0 text-sm font-bold text-primary hover:text-primary-hover flex items-center space-x-1"
            >
              <span>View all tester tasks</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {listingsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-steel/30 rounded-card p-6 bg-canvas animate-pulse h-52 flex flex-col justify-between">
                  <div>
                    <div className="h-5 bg-steel/20 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-steel/20 rounded w-full mb-2"></div>
                    <div className="h-4 bg-steel/20 rounded w-2/3 mb-4"></div>
                  </div>
                  <div className="h-9 bg-steel/20 rounded w-full"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(listings.length > 0 ? listings : DEFAULT_FEED_LISTINGS).map((listing) => {
                const slotsLeft = Math.max(0, (listing.slots_count || 0) - (listing.slots_filled || 0))
                return (
                  <div 
                    key={listing.id}
                    className="border border-steel/30 rounded-card p-6 bg-white flex flex-col justify-between shadow-sm hover:shadow-md hover:border-slate/40 transition-all group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="badge-status badge-open">Open Sky</span>
                        <span className="text-xs font-bold text-slate bg-canvas px-2.5 py-1 rounded-full border border-steel/30">
                          {slotsLeft} {slotsLeft === 1 ? 'slot' : 'slots'} left
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-ink mb-2 group-hover:text-primary transition-colors line-clamp-1">
                        {listing.title}
                      </h3>
                      <p className="text-slate text-sm mb-6 line-clamp-2 leading-relaxed">
                        {listing.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-steel/20 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate font-medium font-mono uppercase tracking-wider">Bounty Rate</span>
                        <span className="text-xl font-extrabold text-ink">
                          ₱{listing.rate_per_tester?.toLocaleString() ?? 0}
                        </span>
                      </div>
                      <Link
                        href="/auth/login?role=tester"
                        className="w-full text-center py-2.5 bg-primary hover:bg-primary-hover text-white rounded-button text-sm font-bold shadow-sm transition-all flex items-center justify-center space-x-1.5"
                      >
                        <span>Claim Slot &amp; Start Test</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Pricing Tiers Section */}
      <section id="pricing" className="py-20 bg-white border-b border-steel/20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-ink tracking-tight mb-4">Flexible, Performance-Based Pricing</h2>
            <p className="text-lg text-slate max-w-2xl mx-auto">
              From fast sanity checks to deep usability audits. Pay only for verified, high-quality test completions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="border border-steel/40 rounded-card p-8 bg-canvas flex flex-col justify-between hover:border-slate transition-all relative">
              <div>
                <div className="absolute top-4 right-4 badge-status badge-open">Micro Task</div>
                <h3 className="text-xl font-bold text-ink mb-2">Micro-Verifications</h3>
                <p className="text-slate text-sm mb-6">Verify critical fields, single-page responsiveness, layout compliance, or copy bugs.</p>
                <div className="mb-6">
                  <span className="text-3xl font-extrabold text-ink">₱50 - ₱150</span>
                  <span className="text-slate text-sm"> / test completion</span>
                </div>
                <ul className="space-y-3 text-sm text-slate border-t border-steel/20 pt-6 mb-8">
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span>Takes 5–10 mins to complete</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span>Visual bug screenshot verification</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span>Fast feedback within 12 hours</span>
                  </li>
                </ul>
              </div>
              <Link 
                href={user ? "/dashboard/poster?tier=micro" : "/auth/login?role=poster"}
                className="w-full text-center py-3 bg-white border border-steel hover:border-slate text-ink rounded-button text-sm font-bold transition-all hover:bg-canvas"
              >
                Create Micro Test
              </Link>
            </div>

            {/* Card 2 */}
            <div className="border-2 border-primary rounded-card p-8 bg-white flex flex-col justify-between shadow-md relative">
              <div className="absolute top-4 right-4 badge-status badge-filling">Recommended</div>
              <div>
                <h3 className="text-xl font-bold text-ink mb-2">Functional Walks</h3>
                <p className="text-slate text-sm mb-6">Test complete multi-step actions like registration, product checkouts, or localized GCash flows.</p>
                <div className="mb-6">
                  <span className="text-3xl font-extrabold text-ink">₱200 - ₱500</span>
                  <span className="text-slate text-sm"> / test completion</span>
                </div>
                <ul className="space-y-3 text-sm text-slate border-t border-steel/20 pt-6 mb-8">
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span>Detailed user journey verification</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span>System log & API response audits</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span>Detailed replication steps file</span>
                  </li>
                </ul>
              </div>
              <Link 
                href={user ? "/dashboard/poster?tier=functional" : "/auth/login?role=poster"}
                className="w-full text-center py-3 bg-primary hover:bg-primary-hover text-white rounded-button text-sm font-bold transition-all shadow-sm"
              >
                Create Functional Test
              </Link>
            </div>

            {/* Card 3 */}
            <div className="border border-steel/40 rounded-card p-8 bg-canvas flex flex-col justify-between hover:border-slate transition-all relative">
              <div className="absolute top-4 right-4 badge-status badge-review">Comprehensive</div>
              <div>
                <h3 className="text-xl font-bold text-ink mb-2">Deep Audits</h3>
                <p className="text-slate text-sm mb-6">Complete test suite execution, screen recordings, network trace analyses, and edge-case hunting.</p>
                <div className="mb-6">
                  <span className="text-3xl font-extrabold text-ink">₱1,000+</span>
                  <span className="text-slate text-sm"> / test completion</span>
                </div>
                <ul className="space-y-3 text-sm text-slate border-t border-steel/20 pt-6 mb-8">
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span>Screen recording + video walkthrough</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span>Network traffic & payload inspection</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span>Direct bug integration push (e.g. Jira)</span>
                  </li>
                </ul>
              </div>
              <Link 
                href={user ? "/dashboard/poster?tier=audit" : "/auth/login?role=poster"}
                className="w-full text-center py-3 bg-white border border-steel hover:border-slate text-ink rounded-button text-sm font-bold transition-all hover:bg-canvas"
              >
                Request Deep Audit
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Marketing Benefits Section */}
      <section id="benefits" className="py-20 bg-canvas border-b border-steel/20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            
            {/* For Builders */}
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white border border-steel/30 rounded-full text-xs font-semibold text-ink mb-6">
                <span>⚡ For Builders</span>
              </div>
              <h2 className="text-3xl font-extrabold text-ink mb-6 tracking-tight">Deploy with confidence.</h2>
              <div className="space-y-8">
                <div>
                  <h4 className="text-lg font-bold text-ink mb-2">Escrow Payment Security</h4>
                  <p className="text-slate text-sm">
                    Fund only the slots you need. Payouts are safely held and only released to testers when their proof meets your verification requirements.
                  </p>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-ink mb-2">Targeted Local Context</h4>
                  <p className="text-slate text-sm">
                    No simulators. Get real tests run on genuine PH mobile devices, local IP addresses, and active local carrier networks.
                  </p>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-ink mb-2">Structured Issue Format</h4>
                  <p className="text-slate text-sm">
                    No messy chat threads. Get precise markdown reports detailing browser, screen width, exact URL, steps to replicate, and attachments.
                  </p>
                </div>
              </div>
            </div>

            {/* For Testers */}
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white border border-steel/30 rounded-full text-xs font-semibold text-ink mb-6">
                <span>💻 For Testers</span>
              </div>
              <h2 className="text-3xl font-extrabold text-ink mb-6 tracking-tight">Your skills are worth real money.</h2>
              <div className="space-y-8">
                <div>
                  <h4 className="text-lg font-bold text-ink mb-2">Guaranteed Payment Locks</h4>
                  <p className="text-slate text-sm">
                    Never worry about clients disappearing. Before you even accept a test task, the poster’s payment has already been verified and locked.
                  </p>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-ink mb-2">Clear, Explicit Metrics</h4>
                  <p className="text-slate text-sm">
                    You know exactly what constitutes a valid test. Clear signifiers and criteria ensure your work is judged objectively and paid fast.
                  </p>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-ink mb-2">Elevate Your Reputation</h4>
                  <p className="text-slate text-sm">
                    Deliver accurate reports and build your tester rank. Higher ranks gain exclusive access to premium functional walks and deep audits.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Notion Status Tints Showcase */}
      <section id="status-showcase" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-ink tracking-tight mb-2">Visual System: Notion-Style Status Tints</h2>
            <p className="text-sm text-slate">We use intuitive, muted pastel status tokens to represent current task phases unambiguously.</p>
          </div>

          <div className="border border-steel/30 rounded-card overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-canvas border-b border-steel/30 text-xs font-bold text-slate uppercase">
                  <th className="px-6 py-4">Task Name</th>
                  <th className="px-6 py-4">Rate</th>
                  <th className="px-6 py-4">Visual Token</th>
                  <th className="px-6 py-4">Context Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel/20 text-sm">
                <tr>
                  <td className="px-6 py-4 font-semibold text-ink">E-Commerce Checkout Flow</td>
                  <td className="px-6 py-4 text-slate">₱350</td>
                  <td className="px-6 py-4">
                    <span className="badge-status badge-open">Open Sky</span>
                  </td>
                  <td className="px-6 py-4 text-slate">Open for general application; slots available.</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-semibold text-ink">GCash Payment Endpoint Trace</td>
                  <td className="px-6 py-4 text-slate">₱500</td>
                  <td className="px-6 py-4">
                    <span className="badge-status badge-filling">Filling Yellow</span>
                  </td>
                  <td className="px-6 py-4 text-slate">Highly active. Limited testing slots remain.</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-semibold text-ink">Registration Input Sanitization</td>
                  <td className="px-6 py-4 text-slate">₱150</td>
                  <td className="px-6 py-4">
                    <span className="badge-status badge-review">Review Lavender</span>
                  </td>
                  <td className="px-6 py-4 text-slate">Verification pending review from the poster.</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-semibold text-ink">Maya QR Scan Flow Audit</td>
                  <td className="px-6 py-4 text-slate">₱400</td>
                  <td className="px-6 py-4">
                    <span className="badge-status badge-released">Released Mint</span>
                  </td>
                  <td className="px-6 py-4 text-slate">Task approved, locked escrow payment sent.</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-semibold text-ink">Legacy PHP Login Cookies</td>
                  <td className="px-6 py-4 text-slate">₱200</td>
                  <td className="px-6 py-4">
                    <span className="badge-status badge-rejected">Rejected Rose</span>
                  </td>
                  <td className="px-6 py-4 text-slate">Submission rejected. Tester has time to update.</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-semibold text-ink">API Key Leakage Vulnerability</td>
                  <td className="px-6 py-4 text-slate">₱1,200</td>
                  <td className="px-6 py-4">
                    <span className="badge-status badge-expired">Expired Gray</span>
                  </td>
                  <td className="px-6 py-4 text-slate">Testing timeframe expired; slots forfeited.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-canvas border-t border-steel/20 mt-auto py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-slate">
          <div className="flex items-center space-x-3">
            <img src="/subukanlogoweb.png" alt="subukAn Logo" className="h-8 w-auto object-contain opacity-80" />
            <span>&copy; {new Date().getFullYear()} subukAn. Created by <a href="https://github.com/justpres" target="_blank" rel="noopener noreferrer" className="hover:text-ink font-semibold transition-colors">Justine Lopez (@justpres)</a>.</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center">
            {!loading && (
              <>
                {!user ? (
                  <Link href="/auth/login" className="hover:text-ink transition-colors">Portal Login</Link>
                ) : (
                  <Link href="/dashboard" className="hover:text-ink transition-colors">Go to Dashboard</Link>
                )}
              </>
            )}
            <Link href="/privacy" className="hover:text-ink transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-ink transition-colors">Terms of Service</Link>
          </div>
          <div className="text-[11px] text-steel">
            Designed according to visual design standard 05-DESIGN.md
          </div>
        </div>
      </footer>
    </div>
  )
}
