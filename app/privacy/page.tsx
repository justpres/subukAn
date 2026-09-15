import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy | SubukAn',
  description: 'SubukAn Privacy Policy complying with the Data Privacy Act of 2012 (RA 10173).',
}

export default function PrivacyPage() {
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
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200/70 rounded-full text-xs font-bold text-emerald-700">
              <Shield className="w-3.5 h-3.5" />
              <span>NPC Data Privacy Act (RA 10173) Compliant</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-poppins">
              Privacy Policy
            </h1>
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
              SubukAn (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your personal data in strict compliance with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173) and its Implementing Rules and Regulations.
            </p>
          </div>

          {/* Section 1: Information We Collect */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">1</span>
              <span>Information We Collect</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>We collect and process the following categories of personal information:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
                <li><strong>Account Data:</strong> Email address, mobile phone number (for OTP authentication and GCash disbursements), and role (Tester or Poster).</li>
                <li><strong>Tester Demographics:</strong> Age range, gender, geographic region, device operating system, and tech familiarity (used strictly for campaign targeting).</li>
                <li><strong>Test Artifacts:</strong> User-submitted screen recordings, audio recordings, screenshots, and task response feedback.</li>
                <li><strong>Financial Reference Data:</strong> PayMongo payment reference IDs and masked GCash payout numbers (we never store raw credit card numbers or CVVs).</li>
              </ul>
            </div>
          </section>

          {/* Section 2: Purpose of Processing */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">2</span>
              <span>Purpose of Data Processing</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>Your data is processed strictly for the following legitimate purposes:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
                <li>Matching testers with relevant usability research campaigns based on demographic criteria.</li>
                <li>Delivering qualitative user feedback and recordings to campaign posters for product improvement.</li>
                <li>Processing GCash disbursements and escrow settlements.</li>
                <li>Adjudicating disputes and preventing fraudulent or automated bot activity.</li>
              </ul>
            </div>
          </section>

          {/* Section 3: Screen & Audio Recording Safeguards */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">3</span>
              <span>Screen &amp; Audio Recording Safeguards</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>
                Screen and microphone recordings are only captured during active testing sessions with your explicit browser permission.
              </p>
              <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-xl space-y-1 text-amber-950">
                <p className="font-bold text-xs">⚠️ Sensitive Data Precaution:</p>
                <p className="text-xs text-amber-900">
                  Testers must never input real passwords, credit card numbers, or open private personal messaging applications during screen recording. Recordings are strictly accessible only by the verified Campaign Poster via encrypted temporary signed URLs.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Data Retention & Security */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">4</span>
              <span>Data Retention &amp; Security Measures</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>
                We employ AES-256 encryption at rest, TLS 1.3 encryption in transit, strict database Row Level Security (RLS), and short-lived media access tokens. Campaign media artifacts are retained for 90 days after campaign completion, after which they are archived or deleted.
              </p>
            </div>
          </section>

          {/* Section 5: Your Rights (Right to Erasure) */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-mono">5</span>
              <span>Your Data Privacy Rights</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
              <p>Under the Data Privacy Act of 2012, you have the right to:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
                <li><strong>Right to be Informed:</strong> Understand how your data is collected and used.</li>
                <li><strong>Right to Access &amp; Rectification:</strong> Access or modify your profile demographics at any time.</li>
                <li><strong>Right to Erasure / Deletion:</strong> Request the deletion of your account and associated personal data by emailing <span className="font-mono text-slate-800">dpo@subukan.com</span> or via account settings.</li>
              </ul>
            </div>
          </section>

          {/* Section 6: Contact & DPO */}
          <section className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              <p className="font-semibold text-slate-800">Data Protection Officer (DPO)</p>
              <p>Email: <span className="font-mono text-slate-700">dpo@subukan.com</span></p>
            </div>
            <div className="flex gap-4">
              <Link href="/terms" className="text-[#2955E3] hover:underline font-medium">Terms of Service</Link>
              <Link href="/nda" className="text-[#2955E3] hover:underline font-medium">Tester NDA</Link>
              <Link href="/refund-policy" className="text-[#2955E3] hover:underline font-medium">Refund Policy</Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
