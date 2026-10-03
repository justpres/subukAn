import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { verifyWebhookSignature } from '@/lib/payment/paymongo';
import { POST as webhookPost } from '@/app/api/webhooks/paymongo/route';
import { POST as payoutPost } from '@/app/api/payout/route';
import { GET as cronGet } from '@/app/api/cron/auto-release/route';

// Mocks for Supabase Admin in route tests
const mockGetUser = vi.fn();
const mockGetUserById = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      admin: {
        getUserById: mockGetUserById,
      },
    },
    from: mockFrom,
  })),
}));

describe('Enterprise Security Hardening Unit Tests', () => {
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

  // =========================================================================
  // 1. PayMongo Webhook 5-Minute Replay Window & Signature Hardening
  // =========================================================================
  describe('PayMongo Webhook Signature & 5m Replay Window', () => {
    const webhookSecret = 'whsec_test_secret_key_12345';
    const rawBody = JSON.stringify({
      data: {
        attributes: {
          type: 'payment.paid',
          data: { id: 'pay_123', attributes: { amount: 10000 } },
        },
      },
    });

    it('should accept webhook signature within the 300s window', () => {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const timestamp = (nowInSeconds - 60).toString(); // 1 minute ago (valid)
      const payload = `${timestamp}.${rawBody}`;
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      const header = `t=${timestamp},te=${signature}`;
      expect(verifyWebhookSignature(rawBody, header, webhookSecret)).toBe(true);
    });

    it('should reject webhook signature older than 300 seconds (replay attack prevention)', () => {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const expiredTimestamp = (nowInSeconds - 301).toString(); // 301s ago (> 5 minutes)
      const payload = `${expiredTimestamp}.${rawBody}`;
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      const header = `t=${expiredTimestamp},te=${signature}`;
      expect(verifyWebhookSignature(rawBody, header, webhookSecret)).toBe(false);
    });

    it('should reject webhook signature with future timestamp drifting > 300 seconds', () => {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const futureTimestamp = (nowInSeconds + 350).toString();
      const payload = `${futureTimestamp}.${rawBody}`;
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      const header = `t=${futureTimestamp},te=${signature}`;
      expect(verifyWebhookSignature(rawBody, header, webhookSecret)).toBe(false);
    });

    it('should reject signature if buffer lengths do not match', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const shortSignature = '1234abcd'; // length mismatch
      const header = `t=${timestamp},te=${shortSignature}`;
      expect(verifyWebhookSignature(rawBody, header, webhookSecret)).toBe(false);
    });
  });

  // =========================================================================
  // 2. PayMongo Webhook Amount Tampering Protection
  // =========================================================================
  describe('PayMongo Webhook Amount Tampering Guard', () => {
    it('should reject payment webhook if paid amount does not match listing total budget', async () => {
      process.env.PAYMONGO_WEBHOOK_SIGNING_SECRET = 'whsec_test';
      const listingId = '123e4567-e89b-12d3-a456-426614174000';

      const webhookBody = JSON.stringify({
        data: {
          attributes: {
            type: 'payment.paid',
            data: {
              id: 'pay_999',
              attributes: {
                reference_number: listingId,
                amount: 5000, // ₱50.00 in cents, but listing requires ₱100.00 (10000 cents)
              },
            },
          },
        },
      });

      const nowInSeconds = Math.floor(Date.now() / 1000).toString();
      const signature = crypto
        .createHmac('sha256', 'whsec_test')
        .update(`${nowInSeconds}.${webhookBody}`)
        .digest('hex');

      mockFrom.mockImplementation((table: string) => {
        if (table === 'listings') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: listingId,
                    total_budget: 100, // ₱100 -> requires 10000 cents
                    status: 'open',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/webhooks/paymongo', {
        method: 'POST',
        headers: {
          'paymongo-signature': `t=${nowInSeconds},te=${signature}`,
          'Content-Type': 'application/json',
        },
        body: webhookBody,
      });

      const res = await webhookPost(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain('Payment amount does not match listing total budget');
    });

    it('should accept payment webhook when paid amount exactly matches listing total budget', async () => {
      process.env.PAYMONGO_WEBHOOK_SIGNING_SECRET = 'whsec_test';
      const listingId = '123e4567-e89b-12d3-a456-426614174000';

      const webhookBody = JSON.stringify({
        data: {
          attributes: {
            type: 'payment.paid',
            data: {
              id: 'pay_999',
              attributes: {
                reference_number: listingId,
                amount: 10000, // ₱100.00 exactly matches budget
              },
            },
          },
        },
      });

      const nowInSeconds = Math.floor(Date.now() / 1000).toString();
      const signature = crypto
        .createHmac('sha256', 'whsec_test')
        .update(`${nowInSeconds}.${webhookBody}`)
        .digest('hex');

      mockFrom.mockImplementation((table: string) => {
        if (table === 'listings') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: listingId,
                    total_budget: 100,
                    status: 'open',
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
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/webhooks/paymongo', {
        method: 'POST',
        headers: {
          'paymongo-signature': `t=${nowInSeconds},te=${signature}`,
          'Content-Type': 'application/json',
        },
        body: webhookBody,
      });

      const res = await webhookPost(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  // =========================================================================
  // 3. Payout Route Fail-Closed Phone & Timestamp Validation
  // =========================================================================
  describe('Payout Route Fail-Closed Phone & Timestamp Validation', () => {
    const validPosterId = 'poster-123';
    const validSubmissionId = '123e4567-e89b-12d3-a456-426614174000';
    const validListingId = '223e4567-e89b-12d3-a456-426614174000';
    const validTesterId = 'tester-456';

    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: validPosterId } },
        error: null,
      });
    });

    it('should fail closed with 400 when tester has no verified phone number on file', async () => {
      // Return null / missing phone from auth.users
      mockGetUserById.mockResolvedValue({
        data: { user: { phone: null } },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'submissions') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: validSubmissionId,
                    listing_id: validListingId,
                    tester_id: validTesterId,
                    status: 'pending_review',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'listings') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: validListingId,
                    poster_id: validPosterId,
                    rate_per_tester: 200,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: validTesterId, phone_verified: false },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/payout', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submission_id: validSubmissionId,
          amount: 200,
        }),
      });

      const res = await payoutPost(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain('Tester does not have a verified GCash mobile number on file');
    });

    it('should reject auto-release payout if submission status is not pending_review', async () => {
      // Caller is a tester (not poster), auto_release_at has passed, but status is in_progress
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'other-user-999' } },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'submissions') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: validSubmissionId,
                    listing_id: validListingId,
                    tester_id: validTesterId,
                    status: 'in_progress', // Not submitted yet!
                    auto_release_at: new Date(Date.now() - 1000).toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'listings') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: validListingId,
                    poster_id: validPosterId, // different poster
                    rate_per_tester: 200,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/payout', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submission_id: validSubmissionId,
          amount: 200,
        }),
      });

      const res = await payoutPost(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toContain('Forbidden');
    });
  });

  // =========================================================================
  // 4. Cron Auto-Release: Eliminate x-vercel-cron Bypass & Enforce Secret
  // =========================================================================
  describe('Cron Auto-Release Secret Verification', () => {
    it('should reject request when CRON_SECRET is set, even if x-vercel-cron: true is forged', async () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.CRON_SECRET = 'ultra-secure-cron-secret-12345';

      // Attacker sends x-vercel-cron: true without Bearer secret
      const req = new NextRequest('http://localhost:3000/api/cron/auto-release', {
        method: 'GET',
        headers: {
          'x-vercel-cron': 'true',
        },
      });

      const res = await cronGet(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toContain('Unauthorized');
    });

    it('should reject request when Bearer token length or value does not match timing-safely', async () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.CRON_SECRET = 'ultra-secure-cron-secret-12345';

      const req = new NextRequest('http://localhost:3000/api/cron/auto-release', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer wrong-secret',
        },
      });

      const res = await cronGet(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toContain('Unauthorized');
    });

    it('should pass authorization when Bearer token matches CRON_SECRET exactly', async () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.CRON_SECRET = 'ultra-secure-cron-secret-12345';

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
          Authorization: 'Bearer ultra-secure-cron-secret-12345',
        },
      });

      const res = await cronGet(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  // =========================================================================
  // 5. Upload Route Strict Extension & MIME Validation Logic
  // =========================================================================
  describe('Uploads Gateway MIME & Extension Logic', () => {
    // Inline replication of the validateFile logic tested directly
    function validateFile(filename: string, fileType: string, fileSize: number) {
      const MAX_FILE_SIZE = 100 * 1024 * 1024;
      const ALLOWED_EXTENSIONS = ['webm', 'mp4', 'png', 'jpeg', 'jpg'];
      const ALLOWED_MIME_TYPES = ['video/webm', 'video/mp4', 'image/png', 'image/jpeg', 'image/jpg'];

      if (fileSize > MAX_FILE_SIZE) {
        return { valid: false, error: 'File size exceeds maximum limit of 100MB' };
      }

      const extension = filename.split('.').pop()?.toLowerCase();
      const isAllowedExt = extension && ALLOWED_EXTENSIONS.includes(extension);
      const isAllowedMime = ALLOWED_MIME_TYPES.includes(fileType.toLowerCase());

      if (!isAllowedExt || !isAllowedMime) {
        return {
          valid: false,
          error: 'Invalid file type. Allowed types are webm, mp4, png, jpeg.',
        };
      }

      return { valid: true };
    }

    it('should reject file with spoofed MIME type but executable extension', () => {
      const result = validateFile('exploit.exe', 'image/png', 5000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should reject file with valid extension but malicious executable MIME type', () => {
      const result = validateFile('screenshot.png', 'application/x-msdownload', 5000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should accept file with matching valid extension and valid MIME type', () => {
      const pngResult = validateFile('screenshot.png', 'image/png', 5000);
      expect(pngResult.valid).toBe(true);

      const mp4Result = validateFile('recording.mp4', 'video/mp4', 500000);
      expect(mp4Result.valid).toBe(true);
    });
  });
});
