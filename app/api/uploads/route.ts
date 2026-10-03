import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import crypto from 'crypto';

// Validate requested fields using Zod
const uploadRequestSchema = z.object({
  filename: z.string().min(1, 'filename is required'),
  fileType: z.string().min(1, 'fileType is required'),
  fileSize: z.number().int().positive('fileSize must be a positive integer'),
});

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 104,857,600 bytes (100MB)
const ALLOWED_EXTENSIONS = ['webm', 'mp4', 'png', 'jpeg', 'jpg'];
const ALLOWED_MIME_TYPES = ['video/webm', 'video/mp4', 'image/png', 'image/jpeg', 'image/jpg'];

/**
 * Validates the file specifications on the server
 */
function validateFile(filename: string, fileType: string, fileSize: number) {
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

/**
 * Extracts the access token from Authorization header or Cookies
 */
function getAuthToken(req: NextRequest): string | null {
  // 1. Check Authorization header
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 2. Check cookies
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    if (accessToken) {
      return accessToken;
    }

    // Fallback search for Supabase SSR or standard auth cookies
    const allCookies = cookieStore.getAll();
    for (const c of allCookies) {
      if (c.name.startsWith('sb-') && c.name.endsWith('-auth-token')) {
        try {
          const parsed = JSON.parse(c.value);
          if (parsed?.access_token) {
            return parsed.access_token;
          }
        } catch {
          // If the cookie content isn't JSON, try using it directly
          return c.value;
        }
      }
    }
  } catch (cookieError) {
    console.error('Error reading cookies in upload route:', cookieError);
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Parse and validate the request body
    const body = await req.json();
    const parseResult = uploadRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { filename, fileType, fileSize } = parseResult.data;

    // 2. Perform size and type checks
    const validation = validateFile(filename, fileType, fileSize);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 3. Check environment configuration
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl) {
      console.error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
      return NextResponse.json(
        { error: 'Internal server configuration error' },
        { status: 500 }
      );
    }

    // 4. Authenticate user session
    const token = getAuthToken(req);
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication session required' },
        { status: 401 }
      );
    }

    // Verify token using Anon client
    const authClient = createClient(supabaseUrl, supabaseAnonKey || '', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid session token' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // 5. Select storage bucket and client
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'task-attachments';

    // If service role is available, use it to bypass/admin operations,
    // otherwise fallback to authenticated user to verify bucket rules.
    const clientToUse = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      : createClient(supabaseUrl, supabaseAnonKey || '', {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        });

    // 6. Generate a unique upload path
    const safeFilename = filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_');
    const uniqueId = crypto.randomUUID();
    const uploadPath = `${userId}/${uniqueId}/${safeFilename}`;

    // 7. Request short-lived signed upload URL
    const { data: uploadData, error: uploadError } = await clientToUse.storage
      .from(bucketName)
      .createSignedUploadUrl(uploadPath);

    if (uploadError || !uploadData) {
      console.error('Storage signed URL generation failed:', uploadError);
      return NextResponse.json(
        { error: `Storage operation failed: ${uploadError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    // 8. Return structured payload
    return NextResponse.json({
      signedUrl: uploadData.signedUrl,
      path: uploadPath,
      bucket: bucketName,
      token: uploadData.token,
    });

  } catch (error: unknown) {
    console.error('Unhandled exception in uploads API route:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { error: 'Internal Server Error', message: errorMessage },
      { status: 500 }
    );
  }
}
