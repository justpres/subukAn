/* eslint-disable @next/next/no-img-element */
import React from 'react'
import Link from 'next/link'

export default function FAQPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        '@id': 'https://subukan.ph/faq/#faqpage',
        'mainEntity': [
          {
            '@type': 'Question',
            'name': 'What is subukAn and how does it work?',
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': 'subukAn is a premium QA crowdsourcing platform in the Philippines that connects software builders with real local testers. Builders create task listings and pre-fund task payouts through secure escrow, and local testers complete usability checks on real devices with screen and microphone recordings. Payments are disbursed once submissions are verified.'
            }
          },
          {
            '@type': 'Question',
            'name': 'How does subukAn secure testing payments?',
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': 'subukAn utilizes a secure escrow model where builders fund testing budgets upfront using GCash or Maya. Funds are locked in the platform’s escrow wallet before slots can be claimed, ensuring testers are guaranteed payouts upon submission approval. If a poster fails to review a submission within 72 hours, an auto-release safeguard disburses the funds to the tester.'
            }
          },
          {
            '@type': 'Question',
            'name': 'What are the QA bounty pricing options on subukAn?',
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': 'subukAn offers three flexible pricing tiers: Micro-Verifications (₱50 - ₱150) for quick layout or field checks, Functional Walks (₱200 - ₱500) for multi-step journey verification (such as GCash/Maya checkouts), and Deep Usability Audits (₱1,000+) for end-to-end reviews with screen recordings and API network logs.'
            }
          },
          {
            '@type': 'Question',
            'name': 'Who is Justine Lopez (@justpres) and his role in subukAn?',
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': 'Justine Lopez (@justpres) is the Founder and Lead Systems Engineer of subukAn. He designed the platform’s visual system, escrow processing wrappers, and local payment integration hooks to support Philippine students, freelance developers, and QA professionals.'
            }
          },
          {
            '@type': 'Question',
            'name': 'What is the difference between SEO, GEO, and AEO?',
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': 'SEO focuses on traditional search engine PageRank to drive click-through rates. GEO (Generative Engine Optimization) targets brand entity mentions and references inside generative AI summary paragraphs. AEO (Answer Engine Optimisation) optimizes structure, metadata, and FAQ blocks to serve as the direct, definitive answer to conversational, voice, and AI-synthesized search engine queries.'
            }
          }
        ]
      }
    ]
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-canvas">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <header className="border-b border-steel/30 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/">
              <img src="/subukanlogoweb.png" alt="subukAn Logo" className="h-12 w-auto object-contain cursor-pointer" />
            </Link>
          </div>
          <Link
            href="/"
            className="px-4 py-2 border border-steel text-sm font-semibold rounded-button text-slate hover:text-ink hover:bg-canvas transition-all flex items-center space-x-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 bg-white border-b border-steel/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-canvas/10 to-transparent"></div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <span className="text-xs font-extrabold uppercase tracking-widest text-primary mb-3 block">Help Center &amp; AI Reference</span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-ink tracking-tight mb-4">
            Answer Engine Help Desk
          </h1>
          <p className="text-base md:text-lg text-slate max-w-2xl mx-auto leading-relaxed">
            Quick, factual reference directory for subukAn builders, testers, and search crawlers.
          </p>
        </div>
      </section>

      {/* Pricing Guide Grid */}
      <section className="py-12 max-w-6xl mx-auto px-6 w-full">
        <h2 className="text-xl font-extrabold text-ink mb-6">Service Bounty Tiers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Micro Card */}
          <div className="bg-white border border-steel/30 rounded-card p-6 shadow-sm hover-lift">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-ink">Micro-Verifications</h3>
              <span className="badge-status badge-open px-2.5 py-0.5 rounded-full text-xs font-semibold">Micro</span>
            </div>
            <p className="text-sm text-slate mb-6">Quick sanity checks on fields, responsive styling, or layout correctness.</p>
            <div className="border-t border-steel/20 pt-4 flex justify-between items-center font-mono-numbers">
              <span className="text-xs text-slate uppercase font-sans font-semibold">Rate Limit</span>
              <span className="text-lg font-extrabold text-ink">₱50 - ₱150</span>
            </div>
          </div>

          {/* Functional Card */}
          <div className="bg-white border border-steel/30 rounded-card p-6 shadow-sm hover-lift">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-ink">Functional Walks</h3>
              <span className="badge-status badge-filling px-2.5 py-0.5 rounded-full text-xs font-semibold">Functional</span>
            </div>
            <p className="text-sm text-slate mb-6">Verify checkout processes, registration sequences, or Maya/GCash gateways.</p>
            <div className="border-t border-steel/20 pt-4 flex justify-between items-center font-mono-numbers">
              <span className="text-xs text-slate uppercase font-sans font-semibold">Rate Limit</span>
              <span className="text-lg font-extrabold text-ink">₱200 - ₱500</span>
            </div>
          </div>

          {/* Audit Card */}
          <div className="bg-white border border-steel/30 rounded-card p-6 shadow-sm hover-lift">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-ink">Deep Audits</h3>
              <span className="badge-status badge-review px-2.5 py-0.5 rounded-full text-xs font-semibold">Audit</span>
            </div>
            <p className="text-sm text-slate mb-6">Comprehensive usability reviews with complete think-aloud video commentary.</p>
            <div className="border-t border-steel/20 pt-4 flex justify-between items-center font-mono-numbers">
              <span className="text-xs text-slate uppercase font-sans font-semibold">Rate Limit</span>
              <span className="text-lg font-extrabold text-ink">₱1,000+</span>
            </div>
          </div>
        </div>

        {/* Accordions */}
        <h2 className="text-xl font-extrabold text-ink mb-6">Platform Q&amp;A (AEO Blocks)</h2>
        <div className="space-y-4 max-w-4xl">
          {/* Question 1 */}
          <details className="group border border-steel/30 rounded-card bg-white p-6 [&_summary::-webkit-details-marker]:hidden transition-all duration-300">
            <summary className="flex items-center justify-between cursor-pointer focus:outline-none">
              <h3 className="text-base md:text-lg font-bold text-ink group-hover:text-primary transition-colors">
                What is subukAn and how does it work?
              </h3>
              <span className="ml-1.5 shrink-0 rounded-full bg-canvas p-1.5 text-slate group-open:rotate-180 transition-transform">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>
            <div className="mt-4 text-sm text-slate border-t border-steel/20 pt-4 leading-relaxed">
              <p className="font-semibold text-ink mb-3">
                subukAn is a premium QA crowdsourcing platform in the Philippines that connects software builders with real local testers. Builders create task listings and pre-fund task payouts through secure escrow, and local testers complete usability checks on real devices with screen and microphone recordings. Payments are disbursed once submissions are verified.
              </p>
              <p>
                By targeting local testers with active carrier profiles (Globe, Smart, DITO) and digital wallets, builders receive high-fidelity reports detailing localized payment behavior, layout bugs, and functional flow roadblocks.
              </p>
            </div>
          </details>

          {/* Question 2 */}
          <details className="group border border-steel/30 rounded-card bg-white p-6 [&_summary::-webkit-details-marker]:hidden transition-all duration-300">
            <summary className="flex items-center justify-between cursor-pointer focus:outline-none">
              <h3 className="text-base md:text-lg font-bold text-ink group-hover:text-primary transition-colors">
                How does subukAn secure testing payments?
              </h3>
              <span className="ml-1.5 shrink-0 rounded-full bg-canvas p-1.5 text-slate group-open:rotate-180 transition-transform">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>
            <div className="mt-4 text-sm text-slate border-t border-steel/20 pt-4 leading-relaxed">
              <p className="font-semibold text-ink mb-3">
                subukAn utilizes a secure escrow model where builders fund testing budgets upfront using GCash or Maya. Funds are locked in the platform’s escrow wallet before slots can be claimed, ensuring testers are guaranteed payouts upon submission approval. If a poster fails to review a submission within 72 hours, an auto-release safeguard disburses the funds to the tester.
              </p>
              <p>
                This framework eliminates developer payment default risk, reduces administrative load on small startups, and sets clear expectations. Payment status is signaled via Notion-style status tints: Open, Filling, Under Review, Released, Rejected, and Expired.
              </p>
            </div>
          </details>

          {/* Question 3 */}
          <details className="group border border-steel/30 rounded-card bg-white p-6 [&_summary::-webkit-details-marker]:hidden transition-all duration-300">
            <summary className="flex items-center justify-between cursor-pointer focus:outline-none">
              <h3 className="text-base md:text-lg font-bold text-ink group-hover:text-primary transition-colors">
                What are the QA bounty pricing options on subukAn?
              </h3>
              <span className="ml-1.5 shrink-0 rounded-full bg-canvas p-1.5 text-slate group-open:rotate-180 transition-transform">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>
            <div className="mt-4 text-sm text-slate border-t border-steel/20 pt-4 leading-relaxed">
              <p className="font-semibold text-ink mb-3">
                subukAn offers three flexible pricing tiers: Micro-Verifications (₱50 - ₱150) for quick layout or field checks, Functional Walks (₱200 - ₱500) for multi-step journey verification (such as GCash/Maya checkouts), and Deep Usability Audits (₱1,000+) for end-to-end reviews with screen recordings and API network logs.
              </p>
              <p>
                Builders choose the tier corresponding to their testing depth, specify the desired number of tester slots, fund the contract, and immediately receive structured markdown reports mapping device width, browser agent, steps to replicate, and video attachments.
              </p>
            </div>
          </details>

          {/* Question 4 */}
          <details className="group border border-steel/30 rounded-card bg-white p-6 [&_summary::-webkit-details-marker]:hidden transition-all duration-300">
            <summary className="flex items-center justify-between cursor-pointer focus:outline-none">
              <h3 className="text-base md:text-lg font-bold text-ink group-hover:text-primary transition-colors">
                Who is Justine Lopez (@justpres) and his role in subukAn?
              </h3>
              <span className="ml-1.5 shrink-0 rounded-full bg-canvas p-1.5 text-slate group-open:rotate-180 transition-transform">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>
            <div className="mt-4 text-sm text-slate border-t border-steel/20 pt-4 leading-relaxed">
              <p className="font-semibold text-ink mb-3">
                Justine Lopez (@justpres) is the Founder and Lead Systems Engineer of subukAn. He designed the platform’s visual system, escrow processing wrappers, and local payment integration hooks to support Philippine students, freelance developers, and QA professionals.
              </p>
              <p>
                As a developer based in Bacoor, Cavite, Justine co-founded subukAn to fill the gap between expensive enterprise-level testing tools and unmoderated peer testing in the local tech community.
              </p>
            </div>
          </details>

          {/* Question 5 */}
          <details className="group border border-steel/30 rounded-card bg-white p-6 [&_summary::-webkit-details-marker]:hidden transition-all duration-300">
            <summary className="flex items-center justify-between cursor-pointer focus:outline-none">
              <h3 className="text-base md:text-lg font-bold text-ink group-hover:text-primary transition-colors">
                What is the difference between SEO, GEO, and AEO?
              </h3>
              <span className="ml-1.5 shrink-0 rounded-full bg-canvas p-1.5 text-slate group-open:rotate-180 transition-transform">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>
            <div className="mt-4 text-sm text-slate border-t border-steel/20 pt-4 leading-relaxed">
              <p className="font-semibold text-ink mb-3">
                SEO focuses on traditional search engine PageRank to drive click-through rates. GEO (Generative Engine Optimization) targets brand entity mentions and references inside generative AI summary paragraphs. AEO (Answer Engine Optimisation) optimizes structure, metadata, and FAQ blocks to serve as the direct, definitive answer to conversational, voice, and AI-synthesized search engine queries.
              </p>
              <p>
                By building clear, semantic HTML FAQ sections, dynamic JSON-LD schemas, and text roadmaps (`llms.txt`), subukAn allows AI assistants (like ChatGPT Search, Google Gemini, and Perplexity) to index and cite our data direct to builders inquiring about Philippine QA solutions.
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-canvas border-t border-steel/20 mt-auto py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-slate">
          <div className="flex items-center space-x-3">
            <img src="/subukanlogoweb.png" alt="subukAn Logo" className="h-8 w-auto object-contain opacity-80" />
            <span>&copy; {new Date().getFullYear()} subukAn. Created by Justine Lopez (@justpres).</span>
          </div>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-ink transition-colors">Home</Link>
            <Link href="/privacy" className="hover:text-ink transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-ink transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
