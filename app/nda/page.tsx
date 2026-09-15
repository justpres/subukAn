import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Lock, ShieldCheck, AlertOctagon } from 'lucide-react'

export const metadata = {
  title: 'Tester Non-Disclosure Agreement (NDA) | SubukAn',
  description: 'SubukAn Tester Confidentiality & Non-Disclosure Agreement for pre-launch product testing.',
}

export default function NDAPage() {
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
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200/70 rounded-full text-xs font-bold text-amber-800">
              <Lock className="w-3.5 h-3.5" />
              <span>Strict Confidentiality Agreement</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-poppins">
              Tester Non-Disclosure Agreement (NDA)
            </h1>
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
              This Non-Disclosure Agreement (&quot;NDA&quot;) is a legally binding covenant between you (&quot;Tester&quot;) and the campaign creators (&quot;Posters&quot;) who entrust unreleased products, prototypes, designs, and proprietary features on SubukAn.
            </p>
          </div>

          {/* Section 1: Definition of Confidential Material */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">1</span>
              <span>Confidential Information</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>
                &quot;Confidential Information&quot; includes all non-public information disclosed to you during testing sessions, including without limitation:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
                <li>Pre-release website staging URLs, staging test credentials, and unreleased APK/iOS mobile application builds.</li>
                <li>Figma prototypes, UI/UX designs, wireframes, user flow sketches, and feature specifications.</li>
                <li>Product roadmaps, business strategies, pricing structures, and unannounced marketing campaigns.</li>
                <li>Identified functional bugs, technical vulnerabilities, or security weaknesses discovered during testing.</li>
              </ul>
            </div>
          </section>

          {/* Section 2: Tester Obligations */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">2</span>
              <span>Tester Covenants &amp; Non-Disclosure Obligations</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>By claiming or participating in any test on SubukAn, you strictly agree:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
                <li><strong>No Public Sharing:</strong> You will NOT publish, leak, tweet, stream, or post screenshots, recordings, or descriptions of any tested product to social media (Facebook, TikTok, Twitter/X, Reddit, YouTube, Discord, etc.).</li>
                <li><strong>No Commercial Exploitation:</strong> You will NOT use, copy, clone, or reverse-engineer any proprietary ideas or designs encountered on SubukAn.</li>
                <li><strong>Exclusive Uploads:</strong> All screen recordings and feedback captured through SubukAn must be submitted exclusively through the platform and not stored on personal cloud drives or shared with third parties.</li>
              </ul>
            </div>
          </section>

          {/* Section 3: Enforcement & Penalties */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">3</span>
              <span>Enforcement &amp; Breach Penalties</span>
            </h2>
            <div className="p-4 bg-rose-50/80 border border-rose-200/80 rounded-xl space-y-2 text-xs text-rose-950">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Zero-Tolerance Policy for Leaks</span>
              </div>
              <p className="leading-relaxed text-rose-900/90">
                Any breach of this NDA will result in:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-rose-900/90 font-medium">
                <li>Immediate permanent ban and forfeiture of all pending withdrawable earnings.</li>
                <li>Blacklisting of associated GCash payout accounts and phone numbers.</li>
                <li>Full cooperation with affected product creators for civil liability or copyright claims where applicable.</li>
              </ul>
            </div>
          </section>

          {/* Section 4: Term & Survival */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">4</span>
              <span>Duration of Confidentiality</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>
                Your duty of confidentiality regarding test materials remains in effect for a period of <strong>two (2) years</strong> from the date of the test session, or until such time as the Campaign Poster publicly launches or releases the product to the general public.
              </p>
            </div>
          </section>

          {/* Section 5: Acceptance */}
          <section className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              <p className="font-semibold text-slate-800">Confidentiality &amp; Compliance Office</p>
              <p>Email: <span className="font-mono text-slate-700">compliance@subukan.com</span></p>
            </div>
            <div className="flex gap-4">
              <Link href="/terms" className="text-[#2955E3] hover:underline font-medium">Terms of Service</Link>
              <Link href="/privacy" className="text-[#2955E3] hover:underline font-medium">Privacy Policy</Link>
              <Link href="/refund-policy" className="text-[#2955E3] hover:underline font-medium">Refund Policy</Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
