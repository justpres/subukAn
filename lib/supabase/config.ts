/**
 * Supabase Environment & URL Sanitization Configuration
 * 
 * Prevents common misconfiguration issues such as accidentally appending
 * /rest/v1, /auth/v1, /storage/v1, /graphql/v1, or trailing slashes
 * to NEXT_PUBLIC_SUPABASE_URL, which causes PostgREST error PGRST125:
 * "Invalid path specified in request URL" during authentication requests.
 */

/**
 * Normalizes and sanitizes a Supabase URL to ensure it points to the root origin
 * without trailing slashes or accidentally appended service subpaths.
 */
export function sanitizeSupabaseUrl(rawUrl: string | undefined | null): string {
  if (!rawUrl) return ''
  let url = rawUrl.trim().replace(/^["']|["']$/g, '').trim()
  if (!url) return ''

  // Strip known service subpaths that operators frequently copy from Supabase dashboard
  url = url.replace(/\/(rest|auth|graphql|storage)\/v\d+\/?$/i, '')
  // Strip trailing slashes
  url = url.replace(/\/+$/, '')

  return url
}

/**
 * Returns the sanitized base Supabase project URL from environment variables.
 */
export function getSupabaseUrl(): string {
  return sanitizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
}

/**
 * Returns the cleaned public anonymous key from environment variables.
 */
export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return key.trim().replace(/^["']|["']$/g, '').trim()
}

/**
 * Returns the cleaned service role secret key from environment variables.
 */
export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return key.trim().replace(/^["']|["']$/g, '').trim()
}
