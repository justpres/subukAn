import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/checkout/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createRouteHandlerClient: vi.fn(),
}))

vi.mock('@/lib/payment/paymongo', () => ({
  createPaymentLink: vi.fn().mockResolvedValue({
    id: 'link_test123',
    url: 'https://checkout.paymongo.com/mock/link_test123',
    reference_number: '123e4567-e89b-12d3-a456-426614174000',
    status: 'active',
  }),
}))

import { createRouteHandlerClient } from '@/lib/supabase/server'

describe('POST /api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 400 for invalid UUID input', async () => {
    const req = new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ listing_id: 'invalid-uuid' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid input parameters')
  })

  it('should return 401 when unauthorized / no session', async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      },
    }
    vi.mocked(createRouteHandlerClient).mockReturnValue(mockSupabase as any)

    const req = new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ listing_id: '123e4567-e89b-12d3-a456-426614174000' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('should return 403 when user does not own the listing', async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user_poster_1' } } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: '123e4567-e89b-12d3-a456-426614174000', poster_id: 'other_user', total_budget: 1000, status: 'open' },
              error: null,
            }),
          }),
        }),
      }),
    }
    vi.mocked(createRouteHandlerClient).mockReturnValue(mockSupabase as any)

    const req = new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ listing_id: '123e4567-e89b-12d3-a456-426614174000' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('should return 200 and checkout_url when authorized owner requests payment link', async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user_poster_1' } } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'listings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: '123e4567-e89b-12d3-a456-426614174000',
                    poster_id: 'user_poster_1',
                    title: 'Test Listing',
                    total_budget: 1000,
                    status: 'open',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'poster_payment_settings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { payment_settings: { sandbox_mode: true } },
                  error: null,
                }),
              }),
            }),
          }
        }
        return {}
      }),
    }
    vi.mocked(createRouteHandlerClient).mockReturnValue(mockSupabase as any)

    const req = new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ listing_id: '123e4567-e89b-12d3-a456-426614174000' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.checkout_url).toContain('https://checkout.paymongo.com/mock/')
  })
})
