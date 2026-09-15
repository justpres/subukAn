import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  if (code) {
    const supabase = createRouteHandlerClient()
    
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('Error exchanging OAuth code for session:', error.message)
        // Redirect to login with error message
        const loginUrl = new URL('/auth/login', request.url)
        loginUrl.searchParams.set('error', 'Authentication failed during OAuth exchange.')
        return NextResponse.redirect(loginUrl)
      }
    } catch (err) {
      console.error('Unexpected error during OAuth callback code exchange:', err)
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('error', 'An unexpected error occurred.')
      return NextResponse.redirect(loginUrl)
    }
  }

  // Prevent open redirect vulnerabilities by validating the redirect target
  let safeRedirectUrl = new URL('/dashboard', requestUrl.origin)
  
  if (next) {
    try {
      // If 'next' is an absolute URL, verify it has the exact same origin
      if (next.startsWith('http://') || next.startsWith('https://')) {
        const parsedNext = new URL(next)
        if (parsedNext.origin === requestUrl.origin) {
          safeRedirectUrl = parsedNext
        }
      } else if (next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) {
        // Relative path: strictly disallow protocol-relative URLs (//) or backslash tricks (/\\)
        const candidate = new URL(next, requestUrl.origin)
        if (candidate.origin === requestUrl.origin) {
          safeRedirectUrl = candidate
        }
      }
    } catch (e) {
      console.error('Failed to parse redirect URL:', e)
      safeRedirectUrl = new URL('/dashboard', requestUrl.origin)
    }
  }

  return NextResponse.redirect(safeRedirectUrl)
}
