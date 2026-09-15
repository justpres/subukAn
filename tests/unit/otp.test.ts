import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, PUT } from '@/app/api/auth/verify-phone/route';
import crypto from 'crypto';

// In-memory mock storage for phone_verifications table in tests
let mockVerificationsDb = new Map<string, any>();

const mockGetUser = vi.fn();
const mockUpdateUserById = vi.fn();

// Build chained query builder for phone_verifications and profiles
const mockFrom = vi.fn((table: string) => {
  if (table === 'phone_verifications') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn((field: string, val: string) => ({
          maybeSingle: vi.fn(async () => {
            const entry = mockVerificationsDb.get(val);
            return { data: entry || null, error: null };
          }),
        })),
      })),
      upsert: vi.fn(async (payload: any) => {
        mockVerificationsDb.set(payload.user_id, { ...payload });
        return { data: payload, error: null };
      }),
      update: vi.fn((updatePayload: any) => ({
        eq: vi.fn(async (field: string, val: string) => {
          const entry = mockVerificationsDb.get(val);
          if (entry) {
            mockVerificationsDb.set(val, { ...entry, ...updatePayload });
          }
          return { data: mockVerificationsDb.get(val), error: null };
        }),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(async (field: string, val: string) => {
          mockVerificationsDb.delete(val);
          return { error: null };
        }),
      })),
    };
  }

  if (table === 'profiles') {
    return {
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    };
  }

  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createRouteHandlerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      admin: {
        updateUserById: mockUpdateUserById,
      },
    },
    from: mockFrom,
  })),
}));

describe('OTP Verification API Route (verify-phone)', () => {
  const mockUser = { id: 'test-user-id', email: 'tester@example.com', user_metadata: {} };
  const mockPhone = '09171234567';

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerificationsDb.clear();
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  });

  describe('POST /api/auth/verify-phone', () => {
    it('should generate a 4-digit code, hash it with SHA-256, and store in database', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/verify-phone', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: mockPhone }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      const dbEntry = mockVerificationsDb.get(mockUser.id);
      expect(dbEntry).toBeDefined();
      expect(dbEntry.phone_number).toBe(mockPhone);
      expect(dbEntry.attempts).toBe(0);
      expect(dbEntry.code_hash).toBeDefined();
      expect(dbEntry.code_hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string

      if (json.devOtpCode) {
        const expectedHash = crypto.createHash('sha256').update(json.devOtpCode).digest('hex');
        expect(dbEntry.code_hash).toBe(expectedHash);
      }
    });
  });

  describe('PUT /api/auth/verify-phone', () => {
    let sentOtpCode: string;

    beforeEach(async () => {
      // Seed OTP in database before each PUT test
      const req = new NextRequest('http://localhost:3000/api/auth/verify-phone', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: mockPhone }),
      });
      const res = await POST(req);
      const json = await res.json();
      sentOtpCode = json.devOtpCode;
    });

    it('should verify successfully with the correct OTP code and delete DB record', async () => {
      expect(sentOtpCode).toBeDefined();
      mockUpdateUserById.mockResolvedValue({ data: { user: {} }, error: null });

      const req = new NextRequest('http://localhost:3000/api/auth/verify-phone', {
        method: 'PUT',
        body: JSON.stringify({ code: sentOtpCode }),
      });

      const res = await PUT(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockVerificationsDb.has(mockUser.id)).toBe(false); // Database entry deleted upon verification
    });

    it('should increment attempts and show remaining attempts on incorrect code', async () => {
      const wrongCode = sentOtpCode === '1111' ? '2222' : '1111';

      // 1st wrong attempt
      const req1 = new NextRequest('http://localhost:3000/api/auth/verify-phone', {
        method: 'PUT',
        body: JSON.stringify({ code: wrongCode }),
      });
      const res1 = await PUT(req1);
      const json1 = await res1.json();

      expect(res1.status).toBe(400);
      expect(json1.error).toContain('2 attempt(s) remaining');
      expect(mockVerificationsDb.get(mockUser.id).attempts).toBe(1);

      // 2nd wrong attempt
      const req2 = new NextRequest('http://localhost:3000/api/auth/verify-phone', {
        method: 'PUT',
        body: JSON.stringify({ code: wrongCode }),
      });
      const res2 = await PUT(req2);
      const json2 = await res2.json();

      expect(res2.status).toBe(400);
      expect(json2.error).toContain('1 attempt(s) remaining');
      expect(mockVerificationsDb.get(mockUser.id).attempts).toBe(2);

      // 3rd wrong attempt - should delete the entry and show failure
      const req3 = new NextRequest('http://localhost:3000/api/auth/verify-phone', {
        method: 'PUT',
        body: JSON.stringify({ code: wrongCode }),
      });
      const res3 = await PUT(req3);
      const json3 = await res3.json();

      expect(res3.status).toBe(400);
      expect(json3.error).toContain('Verification failed due to too many invalid attempts');
      expect(mockVerificationsDb.has(mockUser.id)).toBe(false); // Deleted from database
    });
  });
});
