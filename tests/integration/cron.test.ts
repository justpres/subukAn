import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/auto-release/route';

const mockGetUserById = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: {
        getUserById: mockGetUserById,
      },
    },
    from: mockFrom,
  })),
}));

describe('Auto-Release Cron API Route Integration Tests (GET /api/cron/auto-release)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Authorization & Security Handling', () => {
    it('should return 401 when CRON_SECRET is configured, NODE_ENV is production, and invalid headers sent', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.CRON_SECRET = 'super-secret-cron-token';

      const req = new NextRequest('http://localhost:3000/api/cron/auto-release', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer wrong-secret',
        },
      });

      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toContain('Unauthorized');
    });

    it('should pass authorization when correct Bearer CRON_SECRET is provided', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.CRON_SECRET = 'super-secret-cron-token';

      mockFrom.mockImplementation((table: string) => {
        if (table === 'submissions') {
          return {
            select: () => ({
              eq: () => ({
                lte: async () => ({ data: [], error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/cron/auto-release', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer super-secret-cron-token',
        },
      });

      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should reject authorization when unverified x-vercel-cron header is set without valid Bearer secret in production', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

      const req = new NextRequest('http://localhost:3000/api/cron/auto-release', {
        method: 'GET',
        headers: {
          'x-vercel-cron': 'true',
        },
      });

      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toContain('Unauthorized');
    });
  });

  describe('Auto-release Processing Logic', () => {
    it('should return processed_count: 0 when no expired submissions exist', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'submissions') {
          return {
            select: () => ({
              eq: () => ({
                lte: async () => ({ data: [], error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/cron/auto-release', {
        method: 'GET',
      });

      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.processed_count).toBe(0);
      expect(json.payouts).toEqual([]);
    });

    it('should process payouts for expired submissions, update ledger and approve submission', async () => {
      const expiredSubId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
      const testerId = 'tester-789';
      const listingId = 'listing-456';

      mockGetUserById.mockResolvedValue({
        data: { user: { phone: '09189876543' } },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'submissions') {
          return {
            select: () => ({
              eq: () => ({
                lte: async () => ({
                  data: [
                    {
                      id: expiredSubId,
                      tester_id: testerId,
                      listing_id: listingId,
                      status: 'pending_review',
                      auto_release_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                      listings: {
                        id: listingId,
                        rate_per_tester: 200,
                        slots_count: 1,
                      },
                    },
                  ],
                  error: null,
                }),
                eq: async () => ({
                  data: [{ status: 'approved' }],
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }
        if (table === 'payouts') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'payout-cron-1',
                    submission_id: expiredSubId,
                    tester_id: testerId,
                    amount: 200,
                    status: 'pending',
                  },
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }
        if (table === 'listings') {
          return {
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/cron/auto-release', {
        method: 'GET',
      });

      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.processed_count).toBe(1);
      expect(json.payouts[0]).toMatchObject({
        submission_id: expiredSubId,
        tester_id: testerId,
        amount: 200,
        status: 'completed',
      });
      expect(json.payouts[0].payout_id).toBeDefined();
    });

    it('should handle idempotent skips when payout is already completed', async () => {
      const expiredSubId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
      const testerId = 'tester-789';
      const listingId = 'listing-456';

      mockFrom.mockImplementation((table: string) => {
        if (table === 'submissions') {
          return {
            select: () => ({
              eq: () => ({
                lte: async () => ({
                  data: [
                    {
                      id: expiredSubId,
                      tester_id: testerId,
                      listing_id: listingId,
                      status: 'pending_review',
                      auto_release_at: new Date(Date.now() - 3600000).toISOString(),
                      listings: {
                        id: listingId,
                        rate_per_tester: 200,
                        slots_count: 1,
                      },
                    },
                  ],
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }
        if (table === 'payouts') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'payout-cron-1',
                    submission_id: expiredSubId,
                    tester_id: testerId,
                    amount: 200,
                    status: 'completed',
                    processor_payout_id: 'disb_existing_999',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'listings') {
          return {
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/cron/auto-release', {
        method: 'GET',
      });

      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.processed_count).toBe(1);
      expect(json.payouts[0]).toEqual({
        submission_id: expiredSubId,
        tester_id: testerId,
        amount: 200,
        status: 'completed',
        payout_id: 'disb_existing_999',
      });
    });
  });
});
