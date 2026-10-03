import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { verifyWebhookSignature } from '../../../../lib/payment/paymongo';

interface WebhookAttributes {
  type?: string;
  data?: {
    id?: string;
    type?: string;
    attributes?: {
      amount?: number;
      reference_number?: string;
      external_reference?: string;
      description?: string;
      metadata?: {
        listing_id?: string;
        submission_id?: string;
        idempotency_key?: string;
      };
      [key: string]: unknown;
    };
  };
}

interface WebhookPayload {
  data?: {
    id?: string;
    type?: string;
    attributes?: WebhookAttributes;
  };
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
        console.error('Failed to update listing status to released on webhook:', updateError);
      }
    }
  } catch (error: unknown) {
    console.error('Exception in checkAndUpdateListingStatus:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Read raw body as text for cryptographic signature check
    const rawBody = await request.text();
    const signatureHeader = request.headers.get('paymongo-signature');
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SIGNING_SECRET || '';

    // 2. Validate webhook signature using our wrapper helper (includes 5m replay window check)
    const isValid = verifyWebhookSignature(rawBody, signatureHeader, webhookSecret);
    if (!isValid) {
      console.warn('Unauthorized webhook signature detected.');
      return NextResponse.json({ error: 'Unauthorized: Invalid signature verification' }, { status: 401 });
    }

    // Parse the request payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody) as WebhookPayload;
    } catch (parseError: unknown) {
      console.error('Failed to parse webhook JSON payload:', parseError);
      return NextResponse.json({ error: 'Bad Request: Invalid JSON' }, { status: 400 });
    }

    // Initialize Supabase Admin to update tables bypassing standard user RLS constraints
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Webhook: Supabase configuration keys are missing.');
      return NextResponse.json({ error: 'Internal server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const eventType = payload.data?.attributes?.type;
    const eventData = payload.data?.attributes?.data;
    const attributes = eventData?.attributes;

    console.log(`Processing PayMongo Webhook Event: ${eventType}`);

    // 3. Process events to update listings or payouts
    if (
      eventType === 'link.payment.paid' ||
      eventType === 'payment.paid' ||
      eventType === 'payment.intent.succeeded'
    ) {
      // Find listing ID referenced in metadata, reference number, or description
      const listingId =
        attributes?.reference_number ||
        attributes?.external_reference ||
        attributes?.metadata?.listing_id ||
        attributes?.description?.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/)?.[0];

      if (!listingId) {
        console.warn('Could not extract Listing ID from payment payload attributes:', attributes);
        return NextResponse.json({ error: 'Bad Request: Listing ID reference missing' }, { status: 400 });
      }

      // Fetch Listing to verify existence
      const { data: listing, error: findError } = await supabaseAdmin
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single();

      if (findError || !listing) {
        console.error(`Listing ${listingId} not found in database.`);
        return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
      }

      // Verify payment amount matches listing total budget (in cents)
      const expectedAmountInCents = Math.round(listing.total_budget * 100);
      const paidAmountInCents = attributes?.amount;

      if (typeof paidAmountInCents !== 'number' || paidAmountInCents !== expectedAmountInCents) {
        console.error(
          `Security Alert: Payment amount mismatch for listing ${listingId}. Expected: ${expectedAmountInCents}, Received: ${paidAmountInCents}`
        );
        return NextResponse.json(
          { error: 'Bad Request: Payment amount does not match listing total budget' },
          { status: 400 }
        );
      }

      // Update Listing status to 'filling' (escrow funded)
      const { error: updateError } = await supabaseAdmin
        .from('listings')
        .update({
          status: 'filling',
          escrow_payment_ref: eventData?.id || attributes?.reference_number || 'paymongo_paid',
        })
        .eq('id', listingId);

      if (updateError) {
        console.error('Failed to update listing status:', updateError);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }

      console.log(`Listing ${listingId} funded and status set to filling.`);
      return NextResponse.json({
        success: true,
        message: `Listing status updated to 'filling' for listing ${listingId}`,
      });
    }

    if (
      eventType === 'payout.paid' ||
      eventType === 'payout.successful' ||
      eventType === 'disbursement.paid'
    ) {
      const idempotencyKey = attributes?.metadata?.idempotency_key;
      const submissionId = attributes?.metadata?.submission_id;

      if (!idempotencyKey && !submissionId) {
        console.warn('Disbursement event lacks identifying metadata:', attributes);
        return NextResponse.json({ error: 'Bad Request: Missing metadata tracking' }, { status: 400 });
      }

      // Query payout record by idempotency key or submission ID
      let payoutQuery = supabaseAdmin.from('payouts').select('*');
      if (idempotencyKey) {
        payoutQuery = payoutQuery.eq('idempotency_key', idempotencyKey);
      } else {
        payoutQuery = payoutQuery.eq('submission_id', submissionId);
      }

      const { data: payout, error: findPayoutError } = await payoutQuery.maybeSingle();

      if (findPayoutError || !payout) {
        console.error('No matching payout record found for webhook:', { idempotencyKey, submissionId });
        return NextResponse.json({ error: 'Payout record not found' }, { status: 404 });
      }

      // Update payout status to completed
      const { error: updatePayoutError } = await supabaseAdmin
        .from('payouts')
        .update({
          status: 'completed',
          processor_payout_id: eventData?.id || payout.processor_payout_id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', payout.id);

      if (updatePayoutError) {
        console.error('Failed to update payout record:', updatePayoutError);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }

      // Transition submission status to approved (if it wasn't approved already)
      const { data: submission, error: subError } = await supabaseAdmin
        .from('submissions')
        .select('*')
        .eq('id', payout.submission_id)
        .single();

      if (!subError && submission) {
        if (submission.status !== 'approved') {
          const { error: updateSubError } = await supabaseAdmin
            .from('submissions')
            .update({
              status: 'approved',
              review_completed_at: new Date().toISOString(),
            })
            .eq('id', payout.submission_id);

          if (updateSubError) {
            console.error('Failed to update submission status to approved:', updateSubError);
          }
        }

        // Fetch listing to verify progress and check slot completion
        const { data: listing } = await supabaseAdmin
          .from('listings')
          .select('*')
          .eq('id', submission.listing_id)
          .single();

        if (listing) {
          await checkAndUpdateListingStatus(supabaseAdmin, submission.listing_id, listing.slots_count);
        }
      }

      console.log(`Payout transaction completed for submission ${payout.submission_id}.`);
      return NextResponse.json({
        success: true,
        message: 'Payout transaction completed and submission approved',
      });
    }

    // Default response for unhandled events to prevent PayMongo webhook disabling
    console.log(`Unhandled webhook event type: ${eventType}`);
    return NextResponse.json({
      success: true,
      message: `Webhook received but event type '${eventType}' not processed`,
    });
  } catch (error: unknown) {
    console.error('Critical internal error in webhook router:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: 'Internal server error: ' + errorMessage }, { status: 500 });
  }
}
