import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceRoleKey } from '@/lib/supabase/config';
import { z } from 'zod';
import { processGCashPayout } from '@/lib/payment/paymongo';
import { sanitizeDatabaseError } from '@/lib/utils/error';
import crypto from 'crypto';

const resolveDisputeSchema = z.object({
  submission_id: z.string().uuid({ message: 'Invalid submission ID format' }),
  decision: z.enum(['overrule_payout', 'uphold_rejection'], {
    message: "Decision must be 'overrule_payout' or 'uphold_rejection'",
  }),
  notes: z.string().min(3, 'Resolution explanation notes must be at least 3 characters').max(1000),
});

function getSupabaseAdmin() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseServiceKey = getSupabaseServiceRoleKey();

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

// Authenticate caller and verify administrator privilege
async function verifyAdminUser(req: NextRequest) {
  let token = req.headers.get('authorization')?.split(' ')[1];
  if (!token) {
    try {
      const cookieStore = cookies();
      const tokenCookie = cookieStore.getAll().find((c) => c.name.endsWith('-auth-token'));
      if (tokenCookie) {
        try {
          const parsed = JSON.parse(tokenCookie.value);
          token = parsed?.access_token;
        } catch {
          token = tokenCookie.value;
        }
      }
    } catch {
      // Cookie context fallback
    }
  }

  const supabaseAdmin = getSupabaseAdmin();

  if (!token) {
    // In local development or testing with no tokens provided, allow access if explicitly running locally
    if (process.env.NODE_ENV !== 'production' && req.headers.get('x-dev-admin') === 'true') {
      return { id: 'dev-admin-id', email: 'admin@subukan.local' };
    }
    return null;
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return null;
  }

  // 1. Check profiles table for is_admin flag
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin, role')
    .eq('id', user.id)
    .single();

  if (profile?.is_admin === true) {
    return user;
  }

  // 2. Check environment variable allowlists
  const adminUserIds = (process.env.ADMIN_USER_IDS || '').split(',').map((s) => s.trim());
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase());

  if (adminUserIds.includes(user.id) || (user.email && adminEmails.includes(user.email.toLowerCase()))) {
    return user;
  }

  // 3. Fallback for non-production environments
  if (process.env.NODE_ENV !== 'production') {
    return user;
  }

  return null;
}

/**
 * GET /api/admin/disputes
 * Fetches all active disputed submissions with full context.
 */
export async function GET(req: NextRequest) {
  try {
    const adminUser = await verifyAdminUser(req);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Forbidden: Administrator privileges required' },
        { status: 403 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch submissions that are in dispute or have dispute requests recorded
    const { data: submissions, error } = await supabaseAdmin
      .from('submissions')
      .select(`
        id,
        listing_id,
        tester_id,
        status,
        dispute_status,
        dispute_notes,
        rejection_reason,
        rejection_notes,
        recording_url,
        dispute_resolution_notes,
        dispute_resolved_at,
        created_at,
        updated_at,
        listings (
          id,
          title,
          rate_per_tester,
          poster_id,
          site_url
        ),
        profiles:tester_id (
          id,
          full_name,
          role
        )
      `)
      .or('dispute_status.eq.disputed,dispute_notes.not.is.null')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch disputed submissions:', error);
      return NextResponse.json(
        { error: sanitizeDatabaseError(error, 'Failed to fetch disputes') },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      disputes: submissions || [],
    });

  } catch (error: any) {
    console.error('Internal server error in GET /api/admin/disputes:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/disputes
 * Adjudicates a dispute by either overruling the poster (releasing GCash payout to tester)
 * or upholding the poster's rejection.
 */
export async function POST(req: NextRequest) {
  try {
    const adminUser = await verifyAdminUser(req);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Forbidden: Administrator privileges required' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = resolveDisputeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input parameters', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { submission_id, decision, notes } = parseResult.data;
    const supabaseAdmin = getSupabaseAdmin();

    // Fetch target submission and associated listing
    const { data: submission, error: subError } = await supabaseAdmin
      .from('submissions')
      .select('*, listings(id, title, poster_id, rate_per_tester, slots_count)')
      .eq('id', submission_id)
      .single();

    if (subError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const listing = Array.isArray(submission.listings) ? submission.listings[0] : submission.listings;
    const ratePerTester = listing?.rate_per_tester || 50;

    const resolvedAt = new Date().toISOString();

    if (decision === 'overrule_payout') {
      // 1. Generate strict idempotency key for payout
      const idempotencyKey = crypto
        .createHash('sha256')
        .update(`admin_dispute_${submission_id}:${submission.tester_id}`)
        .digest('hex');

      // Fetch user phone number for GCash disbursement
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(submission.tester_id);
      const testerPhone = authUser?.user?.phone || '09171234567';

      // Process payout
      const payoutResult = await processGCashPayout({
        submissionId: submission_id,
        amount: ratePerTester,
        phoneNumber: testerPhone,
        idempotencyKey,
      });

      // Update payout record
      await supabaseAdmin.from('payouts').upsert({
        submission_id,
        tester_id: submission.tester_id,
        amount: ratePerTester,
        idempotency_key: idempotencyKey,
        status: payoutResult.status === 'completed' ? 'completed' : 'pending',
        processor_payout_id: payoutResult.id,
        processed_at: resolvedAt,
      }, { onConflict: 'idempotency_key' });

      // Update submission status to approved and dispute resolved
      const { error: updateError } = await supabaseAdmin
        .from('submissions')
        .update({
          status: 'approved',
          dispute_status: 'resolved_approved',
          dispute_resolution_notes: notes,
          dispute_resolved_at: resolvedAt,
          dispute_resolved_by: adminUser.id,
          review_completed_at: resolvedAt,
        })
        .eq('id', submission_id);

      if (updateError) {
        console.error('Failed to update submission status on dispute resolution:', updateError);
      }

      // Send notifications to tester and poster
      await supabaseAdmin.from('notifications').insert([
        {
          user_id: submission.tester_id,
          title: 'Dispute Approved: Payout Released',
          message: `Platform moderation reviewed your dispute for "${listing?.title || 'Task'}" and approved your submission. ₱${ratePerTester} has been disbursed to your GCash account.`,
          type: 'payout_processed',
          link_url: '/dashboard/tester',
          is_read: false,
        },
        {
          user_id: listing.poster_id,
          title: 'Dispute Decision: Submission Approved',
          message: `Platform moderation resolved a dispute for listing "${listing?.title || 'Task'}". Resolution Note: "${notes}".`,
          type: 'submission_approved',
          link_url: `/dashboard/poster/listings/${listing.id}/submissions/${submission.id}`,
          is_read: false,
        },
      ]);

      return NextResponse.json({
        success: true,
        message: 'Dispute resolved: Poster overruled and payout disbursed to tester.',
        decision: 'overrule_payout',
        submission_id,
      });

    } else {
      // Decision: uphold_rejection
      const { error: updateError } = await supabaseAdmin
        .from('submissions')
        .update({
          status: 'rejected',
          dispute_status: 'resolved_rejected',
          dispute_resolution_notes: notes,
          dispute_resolved_at: resolvedAt,
          dispute_resolved_by: adminUser.id,
        })
        .eq('id', submission_id);

      if (updateError) {
        console.error('Failed to uphold rejection on dispute:', updateError);
      }

      // Notify tester of decision
      await supabaseAdmin.from('notifications').insert([
        {
          user_id: submission.tester_id,
          title: 'Dispute Resolution: Rejection Upheld',
          message: `Platform moderation reviewed your dispute for "${listing?.title || 'Task'}". Moderator Note: "${notes}". The poster's rejection has been upheld.`,
          type: 'submission_rejected',
          link_url: '/dashboard/tester',
          is_read: false,
        },
      ]);

      return NextResponse.json({
        success: true,
        message: 'Dispute resolved: Poster rejection upheld.',
        decision: 'uphold_rejection',
        submission_id,
      });
    }

  } catch (error: any) {
    console.error('Internal server error in POST /api/admin/disputes:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
