import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { processGCashPayout } from '@/lib/payment/paymongo';

export const dynamic = 'force-dynamic';

interface PayoutSummary {
  submission_id: string;
  tester_id: string;
  amount: number;
  status: 'completed' | 'failed' | 'pending';
  payout_id?: string;
  error?: string;
}

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

export async function GET(request: NextRequest) {
  try {
    // 1. Verify security authorization headers with timing-safe comparison
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    let isAuthorized = false;

    if (cronSecret) {
      // When CRON_SECRET is configured, strictly enforce Bearer token verification with timingSafeEqual.
      // Unverified x-vercel-cron header bypass is eliminated.
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const tokenBuf = Buffer.from(token);
        const secretBuf = Buffer.from(cronSecret);
        if (tokenBuf.length === secretBuf.length && crypto.timingSafeEqual(tokenBuf, secretBuf)) {
          isAuthorized = true;
        }
      }
    } else if (process.env.NODE_ENV !== 'production') {
      // Allow local development testing without CRON_SECRET configured
      isAuthorized = true;
    } else if (request.headers.get('x-vercel-cron') === 'true') {
      // Fallback only if CRON_SECRET is not configured in environment
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid cron secret or headers' },
        { status: 401 }
      );
    }

    // Initialize Supabase Admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase credentials missing from environment variables.');
      return NextResponse.json(
        { error: 'Internal server configuration error: Supabase keys missing' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 2. Query pending submissions whose auto_release_at has passed
    const nowString = new Date().toISOString();
    const { data: submissions, error: subError } = await supabaseAdmin
      .from('submissions')
      .select('*, listings(id, rate_per_tester, slots_count)')
      .eq('status', 'pending_review')
      .lte('auto_release_at', nowString);

    if (subError) {
      console.error('Failed to query expired pending submissions:', subError);
      return NextResponse.json(
        { error: 'Database query error: ' + subError.message },
        { status: 500 }
      );
    }

    const payoutsProcessed: PayoutSummary[] = [];

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired submissions require auto-release at this time.',
        processed_count: 0,
        payouts: [],
      });
    }

    // 3. For each expired submission:
    for (const sub of submissions) {
      const listing = Array.isArray(sub.listings) ? sub.listings[0] : sub.listings;

      if (!listing) {
        console.error(`Listing relation not found for submission ${sub.id}`);
        payoutsProcessed.push({
          submission_id: sub.id,
          tester_id: sub.tester_id,
          amount: 0,
          status: 'failed',
          error: 'Listing details could not be resolved',
        });
        continue;
      }

      const ratePerTester = listing.rate_per_tester;
      const listingSlotsCount = listing.slots_count;

      // Fail-closed phone verification before creating payout record
      const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(sub.tester_id);
      if (authUserError || !authUser) {
        console.warn(`Could not fetch auth user phone for tester ${sub.tester_id}:`, authUserError);
      }
      const testerPhone = authUser?.user?.phone;

      if (!testerPhone || testerPhone.trim() === '') {
        console.warn(`Tester ${sub.tester_id} has no verified GCash phone on file.`);
        payoutsProcessed.push({
          submission_id: sub.id,
          tester_id: sub.tester_id,
          amount: ratePerTester,
          status: 'failed',
          error: 'Tester does not have a verified GCash mobile number on file.',
        });
        continue;
      }

      // Generate the strict idempotency key: sha256(submission_id + tester_id)
      const idempotencyKey = crypto
        .createHash('sha256')
        .update(`${sub.id}:${sub.tester_id}`)
        .digest('hex');

      // Attempt to find existing payout record to prevent double payouts
      const { data: existingPayout, error: checkError } = await supabaseAdmin
        .from('payouts')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (checkError) {
        console.error(`Failed to verify existing payout record for key ${idempotencyKey}:`, checkError);
        payoutsProcessed.push({
          submission_id: sub.id,
          tester_id: sub.tester_id,
          amount: ratePerTester,
          status: 'failed',
          error: 'Failed to verify existing payout record',
        });
        continue;
      }

      // If the payout has already completed, skip it
      if (existingPayout) {
        if (existingPayout.status === 'completed') {
          console.log(`Payout already completed for submission ${sub.id} (idempotent skip).`);
          
          // Make sure submission status is marked approved if payout is completed
          if (sub.status !== 'approved') {
            await supabaseAdmin
              .from('submissions')
              .update({
                status: 'approved',
                review_completed_at: new Date().toISOString(),
              })
              .eq('id', sub.id);

            await checkAndUpdateListingStatus(supabaseAdmin, sub.listing_id, listingSlotsCount);
          }

          payoutsProcessed.push({
            submission_id: sub.id,
            tester_id: sub.tester_id,
            amount: ratePerTester,
            status: 'completed',
            payout_id: existingPayout.processor_payout_id || undefined,
          });
          continue;
        }
        console.log(`Resuming payout for pending/failed ledger record for key ${idempotencyKey}`);
      }

      let payoutRecord = existingPayout;

      // Insert pending record if it doesn't exist yet
      if (!payoutRecord) {
        const { data: insertedPayout, error: insertError } = await supabaseAdmin
          .from('payouts')
          .insert({
            submission_id: sub.id,
            tester_id: sub.tester_id,
            amount: ratePerTester,
            idempotency_key: idempotencyKey,
            status: 'pending',
          })
          .select()
          .single();

        if (insertError) {
          // Handle concurrent database race conditions (e.g. parallel manual release calls)
          if (insertError.code === '23505') {
            const { data: reFetchedPayout } = await supabaseAdmin
              .from('payouts')
              .select('*')
              .eq('idempotency_key', idempotencyKey)
              .single();

            if (reFetchedPayout && reFetchedPayout.status === 'completed') {
              payoutsProcessed.push({
                submission_id: sub.id,
                tester_id: sub.tester_id,
                amount: ratePerTester,
                status: 'completed',
                payout_id: reFetchedPayout.processor_payout_id || undefined,
              });
              continue;
            }
            payoutRecord = reFetchedPayout;
          } else {
            console.error(`Failed to insert payout record for submission ${sub.id}:`, insertError);
            payoutsProcessed.push({
              submission_id: sub.id,
              tester_id: sub.tester_id,
              amount: ratePerTester,
              status: 'failed',
              error: 'Failed to insert pending payout ledger: ' + insertError.message,
            });
            continue;
          }
        } else {
          payoutRecord = insertedPayout;
        }
      }

      if (!payoutRecord) {
        payoutsProcessed.push({
          submission_id: sub.id,
          tester_id: sub.tester_id,
          amount: ratePerTester,
          status: 'failed',
          error: 'Failed to initialize or retrieve payout transaction record',
        });
        continue;
      }

      // Execute GCash Payout
      try {
        const payoutResult = await processGCashPayout({
          submissionId: sub.id,
          amount: ratePerTester,
          phoneNumber: testerPhone,
          idempotencyKey,
        });

        if (payoutResult.status === 'completed') {
          // Update payout record to completed
          await supabaseAdmin
            .from('payouts')
            .update({
              status: 'completed',
              processor_payout_id: payoutResult.id,
              processed_at: new Date().toISOString(),
            })
            .eq('id', payoutRecord.id);

          // Update submission to approved
          await supabaseAdmin
            .from('submissions')
            .update({
              status: 'approved',
              review_completed_at: new Date().toISOString(),
            })
            .eq('id', sub.id);

          // Check if listings slots completed and transition it to released
          await checkAndUpdateListingStatus(supabaseAdmin, sub.listing_id, listingSlotsCount);

          payoutsProcessed.push({
            submission_id: sub.id,
            tester_id: sub.tester_id,
            amount: ratePerTester,
            status: 'completed',
            payout_id: payoutResult.id,
          });
        } else if (payoutResult.status === 'failed') {
          await supabaseAdmin
            .from('payouts')
            .update({ status: 'failed' })
            .eq('id', payoutRecord.id);

          payoutsProcessed.push({
            submission_id: sub.id,
            tester_id: sub.tester_id,
            amount: ratePerTester,
            status: 'failed',
            error: 'Disbursement gateway rejected payment request',
          });
        } else {
          // Disbursement is pending/accepted by gateway
          payoutsProcessed.push({
            submission_id: sub.id,
            tester_id: sub.tester_id,
            amount: ratePerTester,
            status: 'pending',
            payout_id: payoutResult.id,
          });
        }
      } catch (payoutError: unknown) {
        console.error(`Error processing GCash payout for submission ${sub.id}:`, payoutError);
        // Reset payout status to failed in the ledger to allow future retries
        await supabaseAdmin
          .from('payouts')
          .update({ status: 'failed' })
          .eq('id', payoutRecord.id);

        const errorMessage = payoutError instanceof Error ? payoutError.message : 'Payment processor runtime error';
        payoutsProcessed.push({
          submission_id: sub.id,
          tester_id: sub.tester_id,
          amount: ratePerTester,
          status: 'failed',
          error: errorMessage,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed auto-release review cycle.`,
      processed_count: payoutsProcessed.length,
      payouts: payoutsProcessed,
    });
  } catch (error: unknown) {
    console.error('Critical failure in auto-release route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Internal server error: ' + errorMessage },
      { status: 500 }
    );
  }
}
