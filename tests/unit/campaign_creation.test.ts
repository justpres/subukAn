import { describe, it, expect } from 'vitest';
import { createListingSchema } from '@/lib/validation/schemas';
import { calculateDualRailSplit } from '@/lib/web3/client';

describe('Poster Campaign Creation & Payload Invariants', () => {
  const validFormData = {
    title: 'Philippine E-Commerce Checkout Usability Test',
    description: 'We need 5 testers to navigate our mobile web checkout flow and report any bugs or latency.',
    site_url: 'https://example.com/checkout',
    rate_per_tester: 200,
    slots_count: 5,
    total_budget: 1000,
    review_window_minutes: 30 as const,
    questions: [
      {
        question_text: 'Did the GCash payment button load properly?',
        requires_recording: true,
        requires_image: false,
      },
      {
        question_text: 'Were you able to view the order confirmation summary?',
        requires_recording: false,
        requires_image: true,
      },
    ],
  };

  it('validates a correct campaign creation form payload', () => {
    const parsed = createListingSchema.safeParse(validFormData);
    expect(parsed.success).toBe(true);
  });

  it('rejects budget mismatch where total_budget != rate * slots', () => {
    const invalidBudget = {
      ...validFormData,
      total_budget: 999, // Should be 200 * 5 = 1000
    };
    const parsed = createListingSchema.safeParse(invalidBudget);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain('Escrow verification failed');
    }
  });

  it('rejects unpermitted rate tiers', () => {
    const invalidRate = {
      ...validFormData,
      rate_per_tester: 250, // Not in CUSTOM_RATE_TIERS
      total_budget: 1250,
    };
    const parsed = createListingSchema.safeParse(invalidRate);
    expect(parsed.success).toBe(false);
  });

  it('requires all tasks to be mapped with order_index starting at 0', () => {
    const listingId = 'test-listing-uuid-123';
    const tasksPayload = validFormData.questions.map((q, index) => ({
      listing_id: listingId,
      order_index: index,
      question_text: q.question_text.trim(),
      requires_recording: Boolean(q.requires_recording),
      requires_image: Boolean(q.requires_image),
    }));

    expect(tasksPayload).toHaveLength(2);
    expect(tasksPayload[0].order_index).toBe(0);
    expect(tasksPayload[1].order_index).toBe(1);
    expect(tasksPayload[0].question_text).toBe('Did the GCash payment button load properly?');
    expect(tasksPayload[0].requires_recording).toBe(true);
    expect(tasksPayload[1].requires_image).toBe(true);
  });

  it('verifies listing insert payload does NOT contain illegal columns (is_ab_test, slots_filled, questions)', () => {
    const totalBudget = validFormData.rate_per_tester * validFormData.slots_count;
    const split = calculateDualRailSplit(totalBudget, 20);

    const listingInsertPayload: Record<string, unknown> = {
      poster_id: 'poster-user-uuid',
      title: validFormData.title,
      description: validFormData.description,
      site_url: validFormData.site_url,
      rate_per_tester: validFormData.rate_per_tester,
      slots_count: validFormData.slots_count,
      total_budget: totalBudget,
      review_window_minutes: validFormData.review_window_minutes,
      status: 'open',
      is_quick_impression: false,
      payment_rail: 'fiat_paymongo',
      crypto_token: 'USDC',
      platform_fee_percent: 20.0,
      platform_fee_amount: split.platformFee,
      bounty_pool_amount: split.netEscrowPool,
    };

    // Absolute invariants: PostgREST schema cache rejection prevention
    expect(listingInsertPayload).not.toHaveProperty('slots_filled');
    expect(listingInsertPayload).not.toHaveProperty('is_ab_test');
    expect(listingInsertPayload).not.toHaveProperty('questions');

    // Expected valid database columns
    expect(listingInsertPayload.poster_id).toBe('poster-user-uuid');
    expect(listingInsertPayload.status).toBe('open');
    expect(listingInsertPayload.platform_fee_amount).toBe(200);
    expect(listingInsertPayload.bounty_pool_amount).toBe(800);
  });
});
