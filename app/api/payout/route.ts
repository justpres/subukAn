import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { z } from 'zod';
import { processGCashPayout } from '../../../lib/payment/paymongo';

// Define the payload schema
const payoutRequestSchema = z.object({
  submission_id: z.string().uuid({ message: 'Invalid submission ID format' }),
  amount: z.number().int().positive({ message: 'Amount must be a positive integer' }),
});

/**
 * Helper to check listing status and transition it to 'released' if all slots are filled and paid out.
 */
async function checkAndUpdateListingStatus(supabaseAdmin: SupabaseClient, listingId: string, totalSlots: number) {
  try {
    const { data: submissions, error } = await supabaseAdmin
      .from('submissions')
      .select('status')
      .eq('listing_id', listingId);

    if (error || !submissions) {
      console.error('Failed to fetch listing submissions to check completion:', error);
      return;
    }

    const approvedCount = submissions.filter((s: { status: string }) => s.status === 'approved').length;

    if (approvedCount >= totalSlots) {
      const { error: updateError } = await supabaseAdmin
        .from('listings')
        .update({ status: 'released' })
        .eq('id', listingId);

      if (updateError) {
        console.error('Failed to update listing status to released:', updateError);
      }
    }
  } catch (error: unknown) {
    console.error('Exception in checkAndUpdateListingStatus:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validate payload
    const body: unknown = await request.json();
    const result = payoutRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: result.error.format() },
        { status: 400 }
      );
    }

    const { submission_id, amount } = result.data;

    // Initialize Supabase Admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase credentials missing from environment variables.');
      return NextResponse.json(
        { error: 'Internal server configuration error' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 2. Authenticate the active user
    let token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      try {
        const cookieStore = cookies();
        const tokenCookie = cookieStore.getAll().find((c) => c.name.endsWith('-auth-token'));
        if (tokenCookie) {
          try {
            const parsed = JSON.parse(tokenCookie.value) as { access_token?: string };
            token = parsed?.access_token;
          } catch {
            token = tokenCookie.value;
          }
        }
      } catch {
        // cookies() not available outside Next request context
      }
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Session token is missing' },
        { status: 401 }
      );
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or expired session token' },
        { status: 401 }
      );
    }

    // 3. Fetch submission and related listing details
    const { data: submission, error: subError } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', submission_id)
      .single();

    if (subError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const { data: listing, error: listError } = await supabaseAdmin
      .from('listings')
      .select('*')
      .eq('id', submission.listing_id)
      .single();

    if (listError || !listing) {
      return NextResponse.json({ error: 'Associated listing not found' }, { status: 404 });
    }

    // 4. Enforce RLS database authorization checks & auto-release timestamp integrity
    const isPoster = listing.poster_id === user.id;
    const isAutoReleased = Boolean(submission.auto_release_at && new Date(submission.auto_release_at) <= new Date());

    if (!isPoster && !isAutoReleased) {
      return NextResponse.json(
        {
          error: 'Forbidden: You must be the listing poster to trigger payout, or the review window must have expired (auto-released).'
        },
        { status: 403 }
      );
    }

    // If non-poster is triggering via auto-release, verify submission is legitimately pending review
    if (!isPoster && isAutoReleased && submission.status !== 'pending_review') {
      return NextResponse.json(
        { error: 'Forbidden: Auto-release can only be triggered for submissions pending review.' },
        { status: 403 }
      );
    }

    // Check submission status validity
    if (submission.status === 'rejected') {
      return NextResponse.json({ error: 'Conflict: Cannot pay out a rejected submission' }, { status: 400 });
    }
    if (submission.status === 'expired') {
      return NextResponse.json({ error: 'Conflict: Cannot pay out an expired submission' }, { status: 400 });
    }
    if (submission.status === 'in_progress') {
      return NextResponse.json({ error: 'Conflict: Submission is still in progress' }, { status: 400 });
    }

    // Verify rate match
    if (amount !== listing.rate_per_tester) {
      return NextResponse.json(
        { error: `Invalid payout amount: Listing rate is ₱${listing.rate_per_tester}, received ₱${amount}` },
        { status: 400 }
      );
    }

    // Fetch tester profile details (needed for verification check)
    const { data: testerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', submission.tester_id)
      .single();

    if (profileError || !testerProfile) {
      return NextResponse.json({ error: 'Tester profile not found' }, { status: 404 });
    }

    // 5. Fail-Closed Phone Validation: Check tester phone from auth.users (requires service_role)
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(submission.tester_id);
    const testerPhone = authUser?.user?.phone;

    if (!testerPhone || testerPhone.trim() === '') {
      return NextResponse.json(
        { error: 'Cannot disburse payout: Tester does not have a verified GCash mobile number on file.' },
        { status: 400 }
      );
    }

    // 6. Implement strict idempotency keys to prevent double payouts
    // Hash of submission_id + tester_id guarantees only one payout record ever exists for this submission
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${submission_id}:${submission.tester_id}`)
      .digest('hex');

    // Retrieve existing payout record if it exists
    const { data: existingPayout } = await supabaseAdmin
      .from('payouts')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingPayout) {
      if (existingPayout.status === 'completed') {
        return NextResponse.json({
          success: true,
          message: 'Payout already processed successfully (idempotent)',
          payout: existingPayout,
        });
      }
      if (existingPayout.status === 'pending') {
        console.log(`Found pending payout record for key ${idempotencyKey}. Resuming gateway call.`);
      }
    }

    let payoutRecord = existingPayout;

    // Insert pending payout record if none exists
    if (!payoutRecord) {
      const { data: insertedPayout, error: insertError } = await supabaseAdmin
        .from('payouts')
        .insert({
          submission_id,
          tester_id: submission.tester_id,
          amount,
          idempotency_key: idempotencyKey,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        // Handle race conditions where another thread inserted the record concurrently
        if (insertError.code === '23505') {
          const { data: reFetchedPayout } = await supabaseAdmin
            .from('payouts')
            .select('*')
            .eq('idempotency_key', idempotencyKey)
            .single();

          if (reFetchedPayout && reFetchedPayout.status === 'completed') {
            return NextResponse.json({
              success: true,
              message: 'Payout already processed successfully (idempotent)',
              payout: reFetchedPayout,
            });
          }
          payoutRecord = reFetchedPayout;
        } else {
          return NextResponse.json(
            { error: 'Failed to create payout record: ' + insertError.message },
            { status: 500 }
          );
        }
      } else {
        payoutRecord = insertedPayout;
      }
    }

    if (!payoutRecord) {
      return NextResponse.json({ error: 'Failed to initialize payout transaction' }, { status: 500 });
    }

    // 7. Execute the payment processor client wrapper
    // Fetch poster secure payment settings details
    let customSettings: Record<string, unknown> | null = null;
    try {
      const { data: settingsRow } = await supabaseAdmin
        .from('poster_payment_settings')
        .select('payment_settings')
        .eq('id', listing.poster_id)
        .single();
      if (settingsRow?.payment_settings) {
        customSettings = settingsRow.payment_settings as Record<string, unknown>;
      }
    } catch (e: unknown) {
      console.warn('Failed to fetch poster payment settings customSettings:', e);
    }

    try {
      const payoutResult = await processGCashPayout({
        submissionId: submission_id,
        amount,
        phoneNumber: testerPhone,
        idempotencyKey,
        customSettings,
      });

      if (payoutResult.status === 'completed') {
        // Update payout status to completed
        const { data: completedPayout, error: updatePayoutError } = await supabaseAdmin
          .from('payouts')
          .update({
            status: 'completed',
            processor_payout_id: payoutResult.id,
            processed_at: new Date().toISOString(),
          })
          .eq('id', payoutRecord.id)
          .select()
          .single();

        if (updatePayoutError) {
          console.error('Failed to update payout record to completed:', updatePayoutError);
        }

        // Update submission status to approved (if it wasn't approved already)
        if (submission.status !== 'approved') {
          const { error: updateSubError } = await supabaseAdmin
            .from('submissions')
            .update({
              status: 'approved',
              review_completed_at: new Date().toISOString(),
            })
            .eq('id', submission_id);

          if (updateSubError) {
            console.error('Failed to update submission status to approved:', updateSubError);
          }
        }

        // Verify if all slots are approved and update listing status
        await checkAndUpdateListingStatus(supabaseAdmin, submission.listing_id, listing.slots_count);

        return NextResponse.json({
          success: true,
          message: 'Payout processed successfully',
          payout: completedPayout || {
            ...payoutRecord,
            status: 'completed',
            processor_payout_id: payoutResult.id,
            processed_at: new Date().toISOString(),
          },
        });
      } else if (payoutResult.status === 'failed') {
        await supabaseAdmin
          .from('payouts')
          .update({ status: 'failed' })
          .eq('id', payoutRecord.id);

        return NextResponse.json(
          { error: 'Payment gateway rejected or failed the disbursement' },
          { status: 502 }
        );
      } else {
        // Pending state (e.g. async payment processes)
        return NextResponse.json({
          success: true,
          message: 'Disbursement request submitted and is pending gateway verification',
          payout: payoutRecord,
        });
      }
    } catch (processorError: unknown) {
      console.error('Payment gateway error:', processorError);
      // Mark transaction status as failed in DB
      await supabaseAdmin
        .from('payouts')
        .update({ status: 'failed' })
        .eq('id', payoutRecord.id);

      const errorMessage = processorError instanceof Error ? processorError.message : 'Unknown gateway error';
      return NextResponse.json(
        { error: 'Processor connection error: ' + errorMessage },
        { status: 502 }
      );
    }
  } catch (error: unknown) {
    console.error('Internal server error in payout route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unexpected server error';
    return NextResponse.json(
      { error: 'Internal server error: ' + errorMessage },
      { status: 500 }
    );
  }
}
