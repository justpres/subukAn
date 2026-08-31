import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// Zod schemas for input validation
const sendOtpSchema = z.object({
  phoneNumber: z.string().regex(/^(09|\+639|639)\d{9}$/, {
    message: 'Invalid Philippines mobile number format. Must start with 09, 639, or +639 followed by 9 digits.',
  }),
});

const verifyOtpSchema = z.object({
  code: z.string().length(4, { message: 'Verification code must be exactly 4 digits.' }),
});

type OtpEntry = {
  code: string;
  phoneNumber: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
};

// Global in-memory OTP cache to survive hot reloads during development
const globalForOtp = globalThis as unknown as {
  otpCache?: Map<string, OtpEntry>;
};

const otpCache = globalForOtp.otpCache ?? new Map<string, OtpEntry>();

if (process.env.NODE_ENV !== 'production') {
  globalForOtp.otpCache = otpCache;
}

// Normalizes various PH phone formats to E.164 (e.g. +639171234567)
function normalizePhoneNumber(phone: string): string {
  if (phone.startsWith('09')) {
    return '+63' + phone.slice(1);
  }
  if (phone.startsWith('639')) {
    return '+' + phone;
  }
  return phone;
}

// Helper to authenticate user session (supports cookies and Bearer headers)
async function authenticateUser(req: NextRequest) {
  const supabase = createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user;

  // Fallback to checking Authorization header
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (supabaseUrl && supabaseAnonKey) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      const { data: { user: headerUser } } = await authClient.auth.getUser(token);
      if (headerUser) {
        return headerUser;
      }
    }
  }

  return null;
}

// Initialize Supabase Admin client to bypass RLS policies and update auth.users
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase credentials missing from environment variables.');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * POST /api/auth/verify-phone
 * Initiates the phone verification flow by generating and sending a 4-digit OTP.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // 2. Parse and validate body
    const body = await req.json().catch(() => ({}));
    const payload = {
      phoneNumber: body.phoneNumber || body.phone_number || body.phone,
    };

    const parseResult = sendOtpSchema.safeParse(payload);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { phoneNumber } = parseResult.data;

    // 3. Enforce SMS dispatch rate limits (60 seconds)
    const existingEntry = otpCache.get(user.id);
    const now = Date.now();
    if (existingEntry && now - existingEntry.lastSentAt < 60 * 1000) {
      const waitSeconds = Math.ceil((60 * 1000 - (now - existingEntry.lastSentAt)) / 1000);
      return NextResponse.json(
        { error: `Please wait ${waitSeconds} seconds before requesting a new verification code.` },
        { status: 429 }
      );
    }

    // 4. Generate 4-digit code
    const otpCode = crypto.randomInt(1000, 10000).toString();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes validity

    // Store in cache
    otpCache.set(user.id, {
      code: otpCode,
      phoneNumber,
      expiresAt,
      lastSentAt: now,
      attempts: 0,
    });

    // 5. Dispatch SMS (Mock in dev/standard HTTP SMS in prod)
    if (process.env.NODE_ENV === 'development' || !process.env.SMS_API_KEY) {
      console.log(`[SMS MOCK] [User: ${user.id}] OTP Code ${otpCode} sent to ${phoneNumber}`);
    } else {
      console.log(`[SMS DISPATCH] Sending OTP to ${phoneNumber}`);
      try {
        const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber.slice(1) : phoneNumber;
        const response = await fetch('https://api.semaphore.co/api/v4/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            apikey: process.env.SMS_API_KEY,
            number: formattedNumber,
            message: `Your Subukan verification code is ${otpCode}. Valid for 5 minutes.`,
            sendername: process.env.SMS_SENDER_NAME || 'Subukan',
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`SMS gateway API returned error (${response.status}): ${errorText}`);
          return NextResponse.json(
            { error: 'Failed to deliver OTP message via SMS gateway.' },
            { status: 502 }
          );
        }
      } catch (smsError) {
        console.error('Failed sending SMS:', smsError);
        return NextResponse.json(
          { error: 'SMS dispatch gateway failed' },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent successfully.',
      // Return code in development/testing context for convenience
      ...(process.env.NODE_ENV === 'development' ? { devOtpCode: otpCode } : {}),
    });

  } catch (error: any) {
    console.error('Error in phone verification POST handler:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error?.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/auth/verify-phone
 * Validates the verification code and updates profiles/auth columns.
 */
export async function PUT(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await authenticateUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // 2. Parse and validate code
    const body = await req.json().catch(() => ({}));
    const parseResult = verifyOtpSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { code } = parseResult.data;

    // 3. Retrieve from cache and check expiration
    const entry = otpCache.get(user.id);
    if (!entry) {
      return NextResponse.json(
        { error: 'No verification code found. Please request a code first.' },
        { status: 400 }
      );
    }

    if (Date.now() > entry.expiresAt) {
      otpCache.delete(user.id);
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new code.' },
        { status: 400 }
      );
    }

    // 4. Validate matching code using timing-safe comparison
    const codeBuffer = Buffer.from(code);
    const entryBuffer = Buffer.from(entry.code);
    const isMatch = codeBuffer.length === entryBuffer.length && crypto.timingSafeEqual(codeBuffer, entryBuffer);

    if (!isMatch) {
      entry.attempts += 1;
      
      if (entry.attempts >= 3) {
        otpCache.delete(user.id);
        return NextResponse.json(
          { error: 'Verification failed due to too many invalid attempts. Please request a new verification code.' },
          { status: 400 }
        );
      } else {
        const remaining = 3 - entry.attempts;
        return NextResponse.json(
          { error: `Invalid verification code. ${remaining} attempt(s) remaining.` },
          { status: 400 }
        );
      }
    }

    // OTP verified! Clean from cache.
    otpCache.delete(user.id);

    // 5. Update user database profiles and auth credentials
    const supabaseAdmin = getSupabaseAdmin();
    const normalizedPhone = normalizePhoneNumber(entry.phoneNumber);

    // Update phone number directly in auth.users (which requires admin client)
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { 
        phone: normalizedPhone,
        phone_confirm: true,
        user_metadata: {
          ...user.user_metadata,
          phone_verified: true
        }
      }
    );

    if (authUpdateError) {
      console.error('Failed to update phone number in auth.users:', authUpdateError);
      if (authUpdateError.message.includes('already exists') || authUpdateError.message.includes('unique')) {
        return NextResponse.json(
          { error: 'This phone number is already registered to another account.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to update phone registration: ' + authUpdateError.message },
        { status: 500 }
      );
    }

    // Update public.profiles table setting phone_verified = true
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ phone_verified: true })
      .eq('id', user.id);

    if (profileError) {
      console.error('Failed to update phone_verified status in profiles table:', profileError);
      return NextResponse.json(
        { error: 'Failed to update user profile status: ' + profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Phone number verified successfully.',
    });

  } catch (error: any) {
    console.error('Error in phone verification PUT handler:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error?.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
