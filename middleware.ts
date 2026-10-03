import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from './lib/supabase/server'

// In-memory token-bucket rate limiter structure
interface Bucket {
  tokens: number
  lastRefill: number
}

const LIMITER_MAP = new Map<string, Bucket>()
const LIMIT_MAX_TOKENS = 5
const LIMIT_INTERVAL_MS = 60000 // 1 minute
const REFILL_RATE = LIMIT_MAX_TOKENS / LIMIT_INTERVAL_MS // tokens per ms

function getRateLimitInfo(ip: string): { limited: boolean; retryAfter?: number } {
  const now = Date.now()

  // Cleanup old records to prevent memory leak if the map grows too large
  if (LIMITER_MAP.size > 5000) {
    LIMITER_MAP.forEach((value, key) => {
      if (now - value.lastRefill > LIMIT_INTERVAL_MS) {
        LIMITER_MAP.delete(key)
      }
    })
  }

  const bucket = LIMITER_MAP.get(ip)

  if (!bucket) {
    LIMITER_MAP.set(ip, {
      tokens: LIMIT_MAX_TOKENS - 1,
      lastRefill: now,
    })
    return { limited: false }
  }

  const elapsed = now - bucket.lastRefill
  const tokensToAdd = elapsed * REFILL_RATE
  const currentTokens = Math.min(LIMIT_MAX_TOKENS, bucket.tokens + tokensToAdd)

  if (currentTokens >= 1) {
    LIMITER_MAP.set(ip, {
      tokens: currentTokens - 1,
      lastRefill: now,
    })
    return { limited: false }
  }

  const tokensNeeded = 1 - currentTokens
  const msNeeded = tokensNeeded / REFILL_RATE
  const retryAfter = Math.ceil(msNeeded / 1000)

  return {
    limited: true,
    retryAfter: retryAfter > 0 ? retryAfter : 1,
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check rate limiting for uploads, payout, and verify-phone routes
  const cleanPath = pathname.replace(/\/$/, '')
  if (
    cleanPath === '/api/uploads' ||
    cleanPath === '/api/payout' ||
    cleanPath === '/api/auth/verify-phone'
  ) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip')?.trim() ||
      request.ip ||
      '127.0.0.1'

    const { limited, retryAfter } = getRateLimitInfo(ip)

    if (limited) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
          },
        }
      )
    }
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create Middleware Client to retrieve and sync sessions
  const supabase = createMiddlewareClient(request, response)

  // Get current authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 1. If user is logged out and trying to access dashboard, redirect to login page
  if (!user && pathname.startsWith('/dashboard')) {
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // 2. If user is logged in and trying to access login page, redirect to dashboard gate
  if (user && pathname === '/auth/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 3. If user is logged in and accessing dashboard, enforce role separation
  if (user && pathname.startsWith('/dashboard')) {
    try {
      // Fetch user profile from the database
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, is_admin')
        .eq('id', user.id)
        .single()

      // Allow and guard admin routes
      if (pathname.startsWith('/dashboard/admin')) {
        if (process.env.NODE_ENV === 'production' && !profile?.is_admin) {
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
        return response
      }

      if (pathname === '/dashboard' || pathname === '/dashboard/') {
        if (profile && (profile.role === 'poster' || profile.role === 'tester')) {
          return NextResponse.redirect(new URL(`/dashboard/${profile.role}`, request.url))
        }
        return response
      }

      if (error || !profile) {
        // If the profiles table is not created yet or fails schema lookup, allow access to requested subroute
        if (error && (error.code === 'PGRST204' || error.message?.includes('profiles') || error.message?.includes('schema cache'))) {
          return response
        }
        // Profile not found or error fetching it, redirect to dashboard gate to select role
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      const role = profile.role

      // Check for route cross-contamination between posters and testers
      if (pathname.startsWith('/dashboard/poster') && role !== 'poster') {
        if (role === 'tester') {
          return NextResponse.redirect(new URL('/dashboard/tester', request.url))
        }
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      if (pathname.startsWith('/dashboard/tester') && role !== 'tester') {
        if (role === 'poster') {
          return NextResponse.redirect(new URL('/dashboard/poster', request.url))
        }
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    } catch (err) {
      console.error('Error verifying user role in middleware:', err)
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/auth/login',
    '/api/uploads',
    '/api/payout',
    '/api/auth/verify-phone',
  ],
}
