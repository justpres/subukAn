import crypto from 'crypto';

export interface PaymentLinkResponse {
  id: string;
  url: string;
  reference_number: string;
  status: string;
}

export interface PayoutResponse {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  amount: number;
  recipient_phone: string;
}

/**
 * Helper to determine if we are in sandbox / mock mode.
 */
function isSandboxMode(customSettings?: any): boolean {
  if (customSettings && typeof customSettings.sandbox_mode === 'boolean') {
    return customSettings.sandbox_mode;
  }
  const secretKey = customSettings?.paymongo_secret_key || process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey || secretKey.trim() === '' || secretKey === 'undefined') {
    return true;
  }
  if (secretKey.startsWith('mock_')) {
    return true;
  }
  if (secretKey === 'sk_test_your_secret_key') {
    return true;
  }
  return false;
}

/**
 * Creates a payment link.
 * Converts amount to cents (e.g. PHP 50 -> 5000 cents).
 * 
 * @param amount Amount in Philippine Pesos (PHP)
 * @param description Description of the listing / payment
 * @param referenceId Listing ID to reference the payment
 */
export async function createPaymentLink(
  amount: number,
  description: string,
  referenceId: string,
  customSettings?: any
): Promise<PaymentLinkResponse> {
  if (isSandboxMode(customSettings)) {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 500));

    const amountInCents = Math.round(amount * 100);
    const linkId = `link_${crypto.randomBytes(8).toString('hex')}`;
    
    // Create a realistic-looking mock checkout URL
    const url = `https://checkout.paymongo.com/mock/${linkId}?ref=${referenceId}&amt=${amountInCents}`;

    return {
      id: linkId,
      url,
      reference_number: referenceId,
      status: 'active',
    };
  }

  const secretKey = customSettings?.paymongo_secret_key || process.env.PAYMONGO_SECRET_KEY || '';
  const amountInCents = Math.round(amount * 100);
  const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;

  const response = await fetch('https://api.paymongo.com/v1/links', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: amountInCents,
          description,
          reference_number: referenceId,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayMongo API error: ${response.status} - ${errorText}`);
  }

  interface PayMongoLinkResponseData {
    id: string;
    attributes: {
      url: string;
      reference_number?: string;
      status: string;
    };
  }

  interface PayMongoLinkResponseJson {
    data: PayMongoLinkResponseData;
  }

  const resJson = (await response.json()) as PayMongoLinkResponseJson;

  return {
    id: resJson.data.id,
    url: resJson.data.attributes.url,
    reference_number: resJson.data.attributes.reference_number || referenceId,
    status: resJson.data.attributes.status,
  };
}

/**
 * Processes a GCash payout.
 * 
 * @param params Payout parameters including submission ID, amount (PHP), recipient phone, and idempotency key.
 */
export async function processGCashPayout(params: {
  submissionId: string;
  amount: number;
  phoneNumber: string;
  idempotencyKey: string;
  customSettings?: any;
}): Promise<PayoutResponse> {
  if (isSandboxMode(params.customSettings)) {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 800));

    // We'll generate a mock processor transaction ID
    const payoutId = `disb_${crypto.randomBytes(8).toString('hex')}`;

    // Return a successful completion state for testing
    return {
      id: payoutId,
      status: 'completed',
      amount: params.amount,
      recipient_phone: params.phoneNumber,
    };
  }

  const secretKey = params.customSettings?.paymongo_secret_key || process.env.PAYMONGO_SECRET_KEY || '';
  const amountInCents = Math.round(params.amount * 100);
  const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;

  const response = await fetch('https://api.paymongo.com/v1/disbursements', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Idempotency-Key': params.idempotencyKey,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: amountInCents,
          recipient: {
            type: 'gcash',
            phone_number: params.phoneNumber,
          },
          metadata: {
            submission_id: params.submissionId,
            idempotency_key: params.idempotencyKey,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayMongo API error: ${response.status} - ${errorText}`);
  }

  interface PayMongoPayoutResponseData {
    id: string;
    attributes: {
      status: 'pending' | 'completed' | 'failed';
      amount: number;
      recipient: {
        type: string;
        phone_number: string;
      };
    };
  }

  interface PayMongoPayoutResponseJson {
    data: PayMongoPayoutResponseData;
  }

  const resJson = (await response.json()) as PayMongoPayoutResponseJson;

  return {
    id: resJson.data.id,
    status: resJson.data.attributes.status,
    amount: resJson.data.attributes.amount / 100,
    recipient_phone: resJson.data.attributes.recipient.phone_number,
  };
}

/**
 * Verifies the signature of incoming PayMongo webhooks using HMAC SHA256.
 * PayMongo headers format: t=<timestamp>,te=<test_signature>,li=<live_signature>
 * 
 * For testing and local development, if signatureHeader is 'mock-signature' 
 * and NODE_ENV is not production, it skips verification and returns true.
 * 
 * @param rawBody The raw, unmodified HTTP request body as a string.
 * @param signatureHeader The value of the 'paymongo-signature' header.
 * @param webhookSecret The configured webhook signing secret key.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string
): boolean {
  if (!signatureHeader) {
    return false;
  }

  // Developer convenience: allow a mock header in development environments
  if (
    process.env.NODE_ENV !== 'production' &&
    signatureHeader === 'mock-signature'
  ) {
    return true;
  }

  if (!webhookSecret) {
    console.error('PAYMONGO_WEBHOOK_SIGNING_SECRET is not configured.');
    return false;
  }

  // Parse the PayMongo signature header format:
  // e.g. t=1626789000,te=signature1,li=signature2
  const parts = signatureHeader.split(',');
  let timestamp = '';
  let signature = '';

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key || !value) continue;
    
    if (key.trim() === 't') {
      timestamp = value.trim();
    } else if (key.trim() === 'te' || key.trim() === 'li') {
      // Use test signature (te) or live signature (li)
      // Preference given to live signature (li) if both are present
      if (key.trim() === 'li') {
        signature = value.trim();
      } else if (key.trim() === 'te' && !signature) {
        signature = value.trim();
      }
    }
  }

  if (!timestamp || !signature) {
    return false;
  }

  // Enforce 5-minute (300-second) timestamp replay window
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum)) {
    return false;
  }
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowInSeconds - timestampNum) > 300) {
    console.warn(`PayMongo webhook timestamp outside 300s replay window: drift is ${Math.abs(nowInSeconds - timestampNum)}s`);
    return false;
  }

  try {
    // PayMongo payload signature verification is: timestamp + "." + rawBody
    const payload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');

    if (sigBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}
