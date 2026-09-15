import { z } from 'zod';

export const CUSTOM_RATE_TIERS = [50, 100, 200, 300, 400, 500, 1000, 1100] as const;
export type CustomRateTier = typeof CUSTOM_RATE_TIERS[number];

export const createListingSchema = z.object({
  title: z.string()
    .min(5, { message: 'Title must be at least 5 characters long.' })
    .max(100, { message: 'Title cannot exceed 100 characters.' }),
  
  description: z.string()
    .min(20, { message: 'Description must be at least 20 characters long.' })
    .max(2000, { message: 'Description cannot exceed 2000 characters.' }),
  
  site_url: z.string()
    .url({ message: 'Site URL must be a valid URL (e.g. https://example.com).' })
    .optional()
    .or(z.literal('')),
  
  rate_per_tester: z.number({
    required_error: 'Please select a rate per tester.',
    invalid_type_error: 'Rate per tester must be a number.',
  }).refine((val) => CUSTOM_RATE_TIERS.includes(val as CustomRateTier), {
    message: `Rate per tester must be one of the permitted tiers: ₱${CUSTOM_RATE_TIERS.join(', ₱')}`,
  }),
  
  slots_count: z.number({
    required_error: 'Number of target participants is required.',
  })
  .int({ message: 'Slots count must be an integer.' })
  .refine((val) => val === 1 || (val >= 3 && val <= 100), {
    message: 'Slot size must be 1 (for preview round) or between 3 and 100 (for standard listings).',
  }),
  
  total_budget: z.number({
    required_error: 'Total budget must be defined.',
  }).int({ message: 'Budget must be an integer.' }),
  
  review_window_minutes: z.union([z.literal(30), z.literal(60)], {
    errorMap: () => ({ message: 'Review window must be exactly 30 or 60 minutes.' }),
  }),
  
  target_age_group: z.string().optional(),
  target_gender: z.string().optional(),
  target_employment_status: z.string().optional(),
  target_tech_literacy: z.string().optional(),
  target_accessibility_tags: z.array(z.enum(['screen_reader', 'keyboard_only', 'color_blind'])).optional(),
  is_quick_impression: z.boolean().default(false),
  impression_duration_seconds: z.number().int().min(5).max(30).default(5).optional(),
  parent_listing_id: z.string().uuid().nullable().optional(),
  payment_rail: z.enum(['fiat_paymongo', 'crypto_web3']).default('fiat_paymongo').optional(),
  crypto_chain: z.enum(['base', 'polygon', 'solana']).optional(),
  crypto_token: z.string().default('USDC').optional(),
  escrow_contract_address: z.string().optional(),
  escrow_tx_hash: z.string().optional(),
  platform_fee_percent: z.number().default(20.0).optional(),
  platform_fee_amount: z.number().optional(),
  bounty_pool_amount: z.number().optional(),
  variants: z.array(
    z.object({
      id: z.string(),
      title: z.string().min(1, { message: 'Variant name is required.' }),
      url: z.string().url({ message: 'Must be a valid variant URL.' }),
      weight: z.number().int().min(0).max(100).default(50),
    })
  ).optional(),
  
  questions: z.array(
    z.object({
      question_text: z.string()
        .min(5, { message: 'Question must be at least 5 characters long.' })
        .max(500, { message: 'Question cannot exceed 500 characters.' }),
      requires_recording: z.boolean().default(false),
      requires_image: z.boolean().default(false),
    })
  )
  .min(1, { message: 'You must add at least 1 testing question.' })
  .max(10, { message: 'A listing can contain up to 10 questions.' }),
})
.refine((data) => data.total_budget === data.rate_per_tester * data.slots_count, {
  message: 'Escrow verification failed: Total budget does not equal rate multiplied by slots.',
  path: ['total_budget'],
})
.refine((data) => {
  if (data.variants && data.variants.length > 0) {
    const sum = data.variants.reduce((acc, v) => acc + v.weight, 0);
    return sum === 100;
  }
  return true;
}, {
  message: 'Variant weight sum must be exactly 100',
  path: ['variants'],
});

export type CreateListingInput = z.infer<typeof createListingSchema>;

const secureUrlSchema = z.string()
  .url({ message: 'Attachment must be a valid URL format.' })
  .refine((url) => url.startsWith('https://') || url.startsWith('http://localhost'), {
    message: 'Attachment must use a secure protocol (HTTPS) or local environment routing.',
  });

export const taskResponseSchema = z.object({
  task_id: z.string().uuid({ message: 'Invalid Task identifier structure.' }),
  
  answer_text: z.string()
    .min(10, { message: 'Response answer must contain at least 10 characters.' })
    .max(1000, { message: 'Response answer cannot exceed 1000 characters.' }),
  
  completed_successfully: z.boolean({
    required_error: 'Task completion status is required.',
  }),
  
  time_on_task_seconds: z.number({
    required_error: 'Time-on-task tracker must record a duration.',
  })
  .int()
  .positive({ message: 'Time on task must be positive.' })
  .max(7200, { message: 'Recorded session duration cannot exceed 2 hours.' }),
  
  difficulty_rating: z.number({
    required_error: 'Please rate the difficulty of this task.',
  })
  .int()
  .min(1, { message: 'Rating must be at least 1 (Very Easy).' })
  .max(5, { message: 'Rating cannot exceed 5 (Very Hard).' }),
  
  recording_url: secureUrlSchema.nullable().optional(),
  image_url: secureUrlSchema.nullable().optional(),
  first_click_x: z.number().int().nullable().optional(),
  first_click_y: z.number().int().nullable().optional(),
  first_click_time_ms: z.number().int().nullable().optional(),
  first_click_screen_width: z.number().int().nullable().optional(),
  first_click_screen_height: z.number().int().nullable().optional(),
});

export type TaskResponseInput = z.infer<typeof taskResponseSchema>;

export const submitTestResponseSchema = z.object({
  listing_id: z.string().uuid({ message: 'Invalid Listing identifier.' }),
  
  responses: z.array(taskResponseSchema)
    .min(1, { message: 'A submission must contain responses to the questions.' }),
  
  device_fingerprint: z.string()
    .min(5, { message: 'A valid browser fingerprint is required for verification.' })
    .max(256)
    .optional(),
  
  ip_address: z.string()
    .max(45)
    .optional(),
});

export type SubmitTestResponseInput = z.infer<typeof submitTestResponseSchema>;
