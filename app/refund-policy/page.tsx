import React from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Wallet } from 'lucide-react'

export const metadata = {
  title: 'Refund & Escrow Policy | SubukAn',
  description: 'SubukAn Refund and Escrow Return Policy for campaign posters.',
}

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to subukAn</span>
          </Link>
          <span className="text-xs font-mono font-semibold text-slate-400">Last Updated: September 2026</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-12 shadow-xs space-y-10">
          {/* Document Header */}
          <div className="border-b border-slate-200 pb-8 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200/70 rounded-full text-xs font-bold text-[#2955E3]">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Financial Protection Policy</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-poppins">
              Refund &amp; Escrow Return Policy
            </h1>
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
              This policy outlines how unspent campaign budgets, cancelled testing rounds, and escrow refunds are managed for Campaign Posters on SubukAn.
            </p>
          </div>

          {/* Section 1: Unspent Escrow Returns */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">1</span>
              <span>Unspent Escrow for Unfilled Slots</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>
                When a Poster funds a campaign (e.g. 10 tester slots at ₱100 each = ₱1,000 budget), the total amount is locked into escrow.
              </p>
              <p>
                If a campaign concludes, expires, or is closed early with unfilled slots (e.g. only 6 of 10 slots were claimed and completed), <strong>100% of the remaining unspent escrow (₱400)</strong> is returned to the Poster&apos;s registered GCash account or retained as platform balance credits for future campaigns.
              </p>
            </div>
          </section>

          {/* Section 2: Campaign Cancellation */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">2</span>
              <span>Campaign Cancellation Before Claiming</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>
                If a Poster cancels a campaign before any tester has claimed or begun working on a slot, a full refund of the escrow budget will be processed to the original payment method or designated GCash account within 3–5 business days.
              </p>
            </div>
          </section>

          {/* Section 3: Non-Refundable Items */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">3</span>
              <span>Non-Refundable Circumstances</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>Refunds are not applicable under the following conditions:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
                <li>Approved Submissions: Once a tester&apos;s submission is approved by the Poster or auto-released upon expiration of the 72-hour window, the reward is disbursed to the tester and cannot be clawed back.</li>
                <li>Valid Submissions Subject to Upheld Disputes: If an admin overrules an unfair rejection after evaluating a dispute, the bounty disbursed to the tester is non-refundable.</li>
                <li>Third-Party Payment Gateway Transaction Fees (imposed by card networks or GCash).</li>
              </ul>
            </div>
          </section>

          {/* Section 4: Refund Process & Contact */}
          <section className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              <p className="font-semibold text-slate-800">Billing &amp; Refunds Desk</p>
              <p>Email: <span className="font-mono text-slate-700">billing@subukan.com</span></p>
            </div>
            <div className="flex gap-4">
              <Link href="/terms" className="text-[#2955E3] hover:underline font-medium">Terms of Service</Link>
              <Link href="/privacy" className="text-[#2955E3] hover:underline font-medium">Privacy Policy</Link>
              <Link href="/nda" className="text-[#2955E3] hover:underline font-medium">Tester NDA</Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
