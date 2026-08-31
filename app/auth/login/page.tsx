'use client'

import React, { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { AlertCircle, ArrowRight, Zap } from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState<'google' | 'github' | 'credentials' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleDemoLogin = async (role: 'poster' | 'tester') => {
    setLoading('credentials')
    setError(null)
    const supabase = createBrowserClient()
    const demoEmail = role === 'poster' ? 'test-poster@example.com' : 'test-tester@example.com'
    const demoPassword = 'password123'

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      })

      if (signInError) {
        await supabase.auth.signUp({
          email: demoEmail,
          password: demoPassword,
          options: {
            data: {
              role,
              full_name: role === 'poster' ? 'Demo Poster' : 'Demo Tester',
            },
          },
        })
      }
      window.location.href = `/dashboard/${role}`
    } catch (err: unknown) {
      console.warn('Demo login bypass navigation:', err)
      window.location.href = `/dashboard/${role}`
    } finally {
      setLoading(null)
    }
  }

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    setLoading(provider)
    setError(null)
    const supabase = createBrowserClient()

    try {
      let redirectTo = `${window.location.origin}/auth/callback`
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const redirectedFrom = params.get('redirectedFrom')
        const role = params.get('role')
        if (redirectedFrom) {
          redirectTo += `?next=${encodeURIComponent(redirectedFrom)}`
        } else if (role === 'poster' || role === 'tester') {
          redirectTo += `?next=${encodeURIComponent(`/dashboard?role=${role}`)}`
        }
      }

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(null)
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'An unexpected error occurred during sign in.'
      setError(errMsg)
      setLoading(null)
    }
  }

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading('credentials')
    setError(null)
    const supabase = createBrowserClient()

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(null)
      } else {
        let redirectTo = '/dashboard'
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          const redirectedFrom = params.get('redirectedFrom')
          const role = params.get('role')
          if (redirectedFrom && redirectedFrom.startsWith('/')) {
            redirectTo = redirectedFrom
          } else if (role === 'poster' || role === 'tester') {
            redirectTo = `/dashboard?role=${role}`
          }
        }
        window.location.href = redirectTo
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'An unexpected error occurred during sign in.'
      setError(errMsg)
      setLoading(null)
    }
  }


  return (
    <main className="min-h-screen bg-[#FCFBF9] text-[#1E1E1E] flex flex-col justify-between p-6 md:p-12">
      {/* Top Header / Logo */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-2xl tracking-tight text-[#1E1E1E]">subukAn</span>
          <span className="text-[10px] uppercase font-bold tracking-widest bg-[#E3E2E0] text-[#5E5E5E] px-2 py-0.5 rounded-[4px]">
            PILOT
          </span>
        </div>
      </header>

      {/* Main Container */}
      <div className="w-full max-w-md mx-auto my-auto py-10">
        <div className="bg-white border border-[#E3E2E0] rounded-[12px] p-8 md:p-10 shadow-[0_1px_3px_rgba(15,15,15,0.05),0_15px_35px_rgba(15,15,15,0.05)]">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-[#1E1E1E]">
              Welcome back
            </h1>
            <p className="text-sm text-[#5E5E5E] leading-relaxed">
              Sign in to manage listings, submit app tests, and track secure escrow payouts.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 flex gap-3 items-start p-4 bg-[#FFE4E6] border border-[#FFE4E6] text-[#9F1239] rounded-button text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Authentication Error</p>
                <p className="opacity-90">{error}</p>
              </div>
            </div>
          )}

          {/* 1-Click Workspace Quick Access */}
          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-blue-600" />
              1-Click Instant Workspace Access
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleDemoLogin('poster')}
                disabled={loading !== null}
                className="px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>Poster Workspace</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('tester')}
                disabled={loading !== null}
                className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>Tester Hub</span>
              </button>
            </div>
          </div>

          {/* Email / Password Sign-In */}
          <form onSubmit={handleCredentialsSignIn} className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. test-poster@example.com"
                className="w-full px-3 py-2 border border-[#E3E2E0] rounded-[8px] text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-[#E3E2E0] rounded-[8px] text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading !== null}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-[8px] text-sm shadow-sm transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading === 'credentials' ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                'Sign In with Email'
              )}
            </button>
          </form>

          <div className="relative flex items-center justify-center my-6">
            <div className="border-t border-[#E3E2E0] w-full"></div>
            <span className="absolute bg-white px-3 text-xs text-gray-400 font-bold">OR</span>
          </div>

          {/* Social Sign-In Grid */}
          <div className="grid grid-cols-1 gap-4">
            {/* Google Sign-In */}
            <button
              onClick={() => handleOAuthSignIn('google')}
              disabled={loading !== null}
              className="w-full h-11 flex items-center justify-center gap-3 px-4 border border-[#E3E2E0] rounded-button bg-white hover:bg-[#F3F4F6] text-sm font-semibold text-[#1E1E1E] shadow-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading === 'google' ? (
                <svg className="animate-spin h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Continue with Google</span>
            </button>

            {/* GitHub Sign-In */}
            <button
              onClick={() => handleOAuthSignIn('github')}
              disabled={loading !== null}
              className="w-full h-11 flex items-center justify-center gap-3 px-4 border border-[#E3E2E0] rounded-button bg-white hover:bg-[#F3F4F6] text-sm font-semibold text-[#1E1E1E] shadow-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading === 'github' ? (
                <svg className="animate-spin h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 fill-[#1E1E1E]" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
              )}
              <span>Continue with GitHub</span>
            </button>
          </div>

          {/* Custom Info Section */}
          <div className="mt-8 border-t border-[#E3E2E0] pt-6 text-xs text-[#5E5E5E] space-y-4">
            <div className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#2B6CB0] mt-1.5 shrink-0" />
              <p>
                <strong>Role Routing:</strong> After authenticating, you will choose whether to enter the <strong>Poster Dashboard</strong> (to post test listings and set up escrow) or the <strong>Tester Dashboard</strong> (to complete task checklists and receive payments).
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#2B6CB0] mt-1.5 shrink-0" />
              <p>
                <strong>Secure Escrow:</strong> Testing allocations are secured safely via our integrated payment gateway (PayMongo/Xendit) before tasks are released.
              </p>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-[#5E5E5E] hover:text-[#1E1E1E] transition-colors"
          >
            Go back to homepage
            <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between border-t border-[#E3E2E0] pt-6 mt-8 text-xs text-[#5E5E5E] gap-4">
        <div>
          &copy; {new Date().getFullYear()} subukAn. All rights reserved.
        </div>
        <div className="flex gap-6">
          <span className="hover:underline cursor-pointer">Security Policy</span>
          <span className="hover:underline cursor-pointer">Terms of Service</span>
          <span className="hover:underline cursor-pointer">Privacy Policy</span>
        </div>
      </footer>
    </main>
  )
}
