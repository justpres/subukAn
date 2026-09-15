import { createPaymentLink, processGCashPayout, verifyWebhookSignature } from '../lib/payment/paymongo.js';
import { convertPhpToUsdc, calculateDualRailSplit, uuidToBytes32, isValidEvmAddress } from '../lib/web3/client.js';
import { formatCampaignParams } from '../lib/web3/escrow.js';
import http from 'http';

const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
  yellow: '\x1b[33m'
};

async function testSimulation() {
  console.log(\n=== SubukAn Full Simulation Mode Verification ===\n);

  let allPassed = true;

  // 1. Test PayMongo Sandbox Payment Link
  try {
    const paymentLink = await createPaymentLink(1000, 'Test Campaign Escrow', 'test-listing-id-123', { sandbox_mode: true });
    if (paymentLink.url && paymentLink.url.includes('mock')) {
      console.log([✔ PASS] PayMongo Payment Simulation: Generated mock checkout URL -> );
    } else {
      throw new Error('Invalid mock payment link');
    }
  } catch (e) {
    allPassed = false;
    console.log([✖ FAIL] PayMongo Payment Simulation: );
  }

  // 2. Test PayMongo Mock GCash Disbursal
  try {
    const payoutRes = await processGCashPayout({
      amount: 350,
      phoneNumber: '09171234567',
      submissionId: 'test-sub-123',
      idempotencyKey: 'test-idem-123',
      customSettings: { sandbox_mode: true }
    });
    if (payoutRes.id && payoutRes.status === 'completed' && payoutRes.amount === 350) {
      console.log([✔ PASS] PayMongo Payout Simulation: Disbursed ₱ to GCash () with ID: );
    } else {
      throw new Error('Payout simulation returned incomplete response');
    }
  } catch (e) {
    allPassed = false;
    console.log([✖ FAIL] PayMongo Payout Simulation: );
  }

  // 3. Test Webhook Verification Simulation
  try {
    const isWebhookValid = verifyWebhookSignature('{test:payload}', 'mock-signature', 'test-secret');
    if (isWebhookValid) {
      console.log([✔ PASS] Webhook Mock Verification: Successfully verified mock-signature header);
    } else {
      throw new Error('Mock webhook verification failed');
    }
  } catch (e) {
    allPassed = false;
    console.log([✖ FAIL] Webhook Mock Verification: );
  }

  // 4. Test Dual-Rail Escrow Math
  try {
    const split = calculateDualRailSplit(1000, 20);
    const usdc = convertPhpToUsdc(1000, 58.0);
    const usdcSplit = calculateDualRailSplit(usdc, 20);
    if (split.platformFee === 200 && split.netEscrowPool === 800 && usdc === 17.24) {
      console.log([✔ PASS] Dual-Rail Escrow Math: ₱1,000 -> ₱800 Tester Bounty (80%) + ₱200 Platform Take-Rate (20%) | .24 USDC on Base);
    } else {
      throw new Error('Dual-rail math split error');
    }
  } catch (e) {
    allPassed = false;
    console.log([✖ FAIL] Dual-Rail Escrow Math: );
  }

  // 5. Check Local Web Server
  try {
    await new Promise((resolve, reject) => {
      const req = http.get('http://localhost:3000', (res) => {
        if (res.statusCode === 200) {
          console.log([✔ PASS] Local Server Health: http://localhost:3000 returned HTTP 200 OK);
          resolve();
        } else {
          reject(new Error(Server returned HTTP ));
        }
      });
      req.on('error', reject);
    });
  } catch (e) {
    console.log([⚠ NOTE] Local Server: );
  }

  console.log(\n \n);
}

testSimulation();
