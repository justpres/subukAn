import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Scale } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service | SubukAn',
  description: 'SubukAn Terms of Service and Platform Usage Agreement.',
}

export default function TermsPage() {
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
              <Scale className="w-3.5 h-3.5" />
              <span>Platform Legal Agreement</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-poppins">
              Terms of Service
            </h1>
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
              These Terms of Service govern your access to and use of the SubukAn crowd-testing and usability feedback platform. By registering an account as a Tester or Campaign Poster, you agree to be bound by these terms.
            </p>
          </div>

          {/* Section 1: Platform Role */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">1</span>
              <span>Platform Role &amp; Intermediary Status</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>
                SubukAn operates as a technology intermediary platform connecting digital product builders, designers, and startups (&quot;Posters&quot;) with verified testers residing in the Philippines (&quot;Testers&quot;) for the purpose of usability testing, bug reporting, and functional reviews.
              </p>
              <p>
                SubukAn is not an employer, employment agency, or joint venture partner. Testers act exclusively as independent micro-task contractors who choose voluntarily when, where, and which testing campaigns to accept.
              </p>
            </div>
          </section>

          {/* Section 2: Campaign Funding & Escrow */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">2</span>
              <span>Campaign Funding &amp; Escrow Safeguards</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>
                <strong>Pre-Funded Campaigns:</strong> Posters must 100% pre-fund their campaign budgets via authorized payment gateways (PayMongo: GCash, Maya, Cards) before test slots become available for claiming.
              </p>
              <p>
                <strong>Escrow Lock:</strong> Funds remain securely held in escrow until one of the following release conditions is fulfilled:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
                <li>The Campaign Poster approves the tester&apos;s submitted video, audio, or feedback.</li>
                <li>The <strong>72-Hour Auto-Release Safeguard</strong> triggers if the Poster takes no review action within 72 hours of submission.</li>
                <li>The SubukAn Dispute Resolution Team overrules a rejection following an adjudicated tester dispute.</li>
              </ul>
            </div>
          </section>

          {/* Section 3: Review Windows & Auto-Release */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">3</span>
              <span>Review Windows &amp; 72-Hour Inactivity Rule</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>
                To ensure fair treatment of testers, Campaign Posters agree to review submitted tasks within a timely manner. If a poster fails to either approve or reject a submission with specific reason codes within <strong>72 hours</strong> from submission, the platform&apos;s automated serverless cron will automatically approve the submission and disburse the bounty to the tester&apos;s withdrawable balance.
              </p>
            </div>
          </section>

          {/* Section 4: Dispute Resolution & Moderation */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">4</span>
              <span>Dispute Resolution (DTI Compliance)</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>
                In compliance with Republic Act No. 11967 (<em>Internet Transactions Act of 2023</em>), SubukAn maintains an internal dispute resolution mechanism:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
                <li>If a submission is rejected, the tester may file a formal dispute within 48 hours detailing why the rejection was improper.</li>
                <li>The SubukAn Moderation Team independently examines screen recordings, time logs, and provided instructions.</li>
                <li>The Moderation Team&apos;s decision is final and binding on both parties.</li>
              </ul>
            </div>
          </section>

          {/* Section 5: Confidentiality & Non-Disclosure */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">5</span>
              <span>Tester Confidentiality &amp; NDA</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>
                Testers frequently test pre-launch, proprietary, or unreleased digital products. All testers are strictly bound by the <Link href="/nda" className="text-[#2955E3] font-semibold underline">SubukAn Tester Non-Disclosure Agreement (NDA)</Link>. Any unauthorized sharing of screenshots, leaks, recordings, or product details outside the platform will result in immediate permanent account termination and forfeiture of pending balances.
              </p>
            </div>
          </section>

          {/* Section 6: Contact & Inquiries */}
          <section className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              <p className="font-semibold text-slate-800">Questions or Legal Inquiries?</p>
              <p>Contact us at <span className="font-mono text-slate-700">legal@subukan.com</span></p>
            </div>
            <div className="flex gap-4">
              <Link href="/privacy" className="text-[#2955E3] hover:underline font-medium">Privacy Policy</Link>
              <Link href="/nda" className="text-[#2955E3] hover:underline font-medium">Tester NDA</Link>
              <Link href="/refund-policy" className="text-[#2955E3] hover:underline font-medium">Refund Policy</Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
