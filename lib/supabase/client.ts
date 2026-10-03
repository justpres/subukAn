import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseUrl, getSupabaseAnonKey } from './config'

let supabaseInstance: SupabaseClient | null = null

// Custom browser cookie storage helper for Supabase Auth
const cookieStorage = {
  getItem: (key: string): string | null => {
    if (typeof document === 'undefined') return null
    const name = encodeURIComponent(key) + '='
    const decodedCookie = decodeURIComponent(document.cookie)
    const ca = decodedCookie.split(';')
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i]
      while (c.charAt(0) === ' ') {
        c = c.substring(1)
      }
      if (c.indexOf(name) === 0) {
        return c.substring(name.length, c.length)
      }
    }
    return null
  },
  setItem: (key: string, value: string): void => {
    if (typeof document === 'undefined') return
    // Store cookie with a 365-day expiry
    const date = new Date()
    date.setTime(date.getTime() + 365 * 24 * 60 * 60 * 1000)
    const expires = '; expires=' + date.toUTCString()
    document.cookie = `${encodeURIComponent(key)}=${value}${expires}; path=/; SameSite=Lax; Secure`
  },
  removeItem: (key: string): void => {
    if (typeof document === 'undefined') return
    document.cookie = `${encodeURIComponent(key)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax; Secure`
  },
}

export function createBrowserClient() {
  if (supabaseInstance) return supabaseInstance

  const supabaseUrl = getSupabaseUrl()
  const supabaseAnonKey = getSupabaseAnonKey()

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      'Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) are missing.'
    )
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: cookieStorage,
    },
  })

  return supabaseInstance
}

