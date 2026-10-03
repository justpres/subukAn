#!/usr/bin/env node

/**
 * SubukAn Platform - Production Preflight Health Checker
 * 
 * Verifies environment secrets, database tables, storage buckets, 
 * and payment gateways before deploying to live production.
 * 
 * Usage:
 *   node scripts/preflight-check.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env.local if present
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

const checks = [];

function recordCheck(name, status, message) {
  checks.push({ name, status, message });
  const icon = status === 'PASS' ? `${c.green}✔ PASS${c.reset}` : status === 'WARN' ? `${c.yellow}⚠ WARN${c.reset}` : `${c.red}✖ FAIL${c.reset}`;
  console.log(`[${icon}] ${c.bold}${name}${c.reset}: ${message}`);
}

async function runPreflight() {
  console.log(`\n${c.bold}${c.blue}=== SubukAn Platform Preflight Production Verification ===${c.reset}\n`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 1. Supabase Environment Variables
  if (!supabaseUrl || supabaseUrl.includes('your-supabase-project')) {
    recordCheck('Supabase URL', 'FAIL', 'NEXT_PUBLIC_SUPABASE_URL is missing or using placeholder');
  } else if (/\/(rest|auth|graphql|storage)\/v\d+\/?$/i.test(supabaseUrl)) {
    recordCheck('Supabase URL Format', 'FAIL', `NEXT_PUBLIC_SUPABASE_URL contains invalid subpath (${supabaseUrl}). Remove '/rest/v1' or '/auth/v1' - must be base project URL (e.g. https://xyz.supabase.co)`);
  } else if (supabaseUrl.endsWith('/')) {
    recordCheck('Supabase URL Format', 'WARN', `NEXT_PUBLIC_SUPABASE_URL ends with a trailing slash (${supabaseUrl}). Recommended: remove trailing slash.`);
  } else {
    recordCheck('Supabase URL', 'PASS', `Configured (${supabaseUrl})`);
  }

  if (!supabaseAnonKey || supabaseAnonKey.includes('your-supabase-anon-key')) {
    recordCheck('Supabase Anon Key', 'FAIL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or placeholder');
  } else {
    recordCheck('Supabase Anon Key', 'PASS', 'Configured');
  }

  if (!supabaseServiceKey || supabaseServiceKey.includes('your-supabase-service-role-key')) {
    recordCheck('Supabase Service Role Key', 'FAIL', 'SUPABASE_SERVICE_ROLE_KEY is missing or placeholder');
  } else {
    recordCheck('Supabase Service Role Key', 'PASS', 'Configured');
  }

  // 2. Database Tables Verification
  if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-supabase-project')) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const requiredTables = [
        'profiles',
        'listings',
        'submissions',
        'payouts',
        'notifications',
        'poster_payment_settings',
        'submission_comments',
        'phone_verifications',
      ];

      for (const table of requiredTables) {
        const { error } = await supabaseAdmin.from(table).select('count', { count: 'exact', head: true });
        if (error) {
          if (error.message.includes('relation') || error.message.includes('does not exist')) {
            recordCheck(`Database Table: ${table}`, 'FAIL', `Table '${table}' is missing from database schema`);
          } else {
            recordCheck(`Database Table: ${table}`, 'WARN', `Table query returned: ${error.message}`);
          }
        } else {
          recordCheck(`Database Table: ${table}`, 'PASS', `Table exists and is accessible`);
        }
      }

      // 3. Supabase Storage Bucket Verification
      try {
        const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();
        if (bucketError) {
          recordCheck('Storage: task-attachments', 'WARN', `Failed to list buckets: ${bucketError.message}`);
        } else {
          const taskBucket = buckets?.find((b) => b.name === 'task-attachments');
          if (taskBucket) {
            recordCheck('Storage: task-attachments', 'PASS', `Bucket 'task-attachments' exists (Public: ${taskBucket.public})`);
          } else {
            recordCheck('Storage: task-attachments', 'FAIL', `Bucket 'task-attachments' is NOT found in Supabase project`);
          }
        }
      } catch (storageErr) {
        recordCheck('Storage: task-attachments', 'WARN', `Storage check exception: ${storageErr.message}`);
      }

    } catch (dbErr) {
      recordCheck('Database Connectivity', 'FAIL', `Connection failed: ${dbErr.message}`);
    }
  }

  // 4. PayMongo Gateway Configuration
  const paymongoSecret = process.env.PAYMONGO_SECRET_KEY;
  const paymongoWebhookSecret = process.env.PAYMONGO_WEBHOOK_SIGNING_SECRET || process.env.PAYMONGO_WEBHOOK_SECRET;

  if (!paymongoSecret || paymongoSecret.includes('sk_test_your_secret_key')) {
    recordCheck('PayMongo Secret Key', 'WARN', 'PAYMONGO_SECRET_KEY is missing or placeholder (Mock/Sandbox mode will be active)');
  } else if (paymongoSecret.startsWith('sk_live_')) {
    recordCheck('PayMongo Secret Key', 'PASS', 'Live Production Key detected (sk_live_...)');
  } else if (paymongoSecret.startsWith('sk_test_')) {
    recordCheck('PayMongo Secret Key', 'WARN', 'Test Sandbox Key detected (sk_test_...) - will use PayMongo Test Gateway');
  } else {
    recordCheck('PayMongo Secret Key', 'PASS', 'Custom secret key configured');
  }

  if (!paymongoWebhookSecret || paymongoWebhookSecret.includes('your_paymongo_webhook_secret')) {
    recordCheck('PayMongo Webhook Secret', 'WARN', 'PAYMONGO_WEBHOOK_SIGNING_SECRET is missing (Webhooks cannot verify HMAC signatures)');
  } else {
    recordCheck('PayMongo Webhook Secret', 'PASS', 'Webhook signing secret configured');
  }

  // 5. Semaphore SMS Gateway
  const smsKey = process.env.SMS_API_KEY;
  if (!smsKey || smsKey.includes('your_sms_api_key')) {
    recordCheck('Semaphore SMS Key', 'WARN', 'SMS_API_KEY is not configured (Phone verification will log OTP to console)');
  } else {
    recordCheck('Semaphore SMS Key', 'PASS', 'SMS_API_KEY configured');
  }

  // 6. Cron Secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.includes('your_cron_secret')) {
    recordCheck('Cron Secret', 'WARN', 'CRON_SECRET is not configured (Production auto-release endpoint requires CRON_SECRET Bearer token)');
  } else {
    recordCheck('Cron Secret', 'PASS', 'CRON_SECRET configured');
  }

  // Summary
  console.log(`\n${c.bold}=== Preflight Summary ===${c.reset}`);
  const passCount = checks.filter((c) => c.status === 'PASS').length;
  const warnCount = checks.filter((c) => c.status === 'WARN').length;
  const failCount = checks.filter((c) => c.status === 'FAIL').length;

  console.log(`Total Checks: ${checks.length} | ${c.green}Passed: ${passCount}${c.reset} | ${c.yellow}Warnings: ${warnCount}${c.reset} | ${c.red}Failures: ${failCount}${c.reset}\n`);

  if (failCount > 0) {
    console.log(`${c.red}${c.bold}RESULT: NO-GO${c.reset} - Please resolve the failed configuration items before opening to production users.\n`);
  } else if (warnCount > 0) {
    console.log(`${c.yellow}${c.bold}RESULT: CAUTION (STAGING READY)${c.reset} - Configuration is valid for Sandbox/Beta, but live merchant keys are needed for real GCash payouts.\n`);
  } else {
    console.log(`${c.green}${c.bold}RESULT: GO FOR PRODUCTION${c.reset} - All services, database tables, and credentials verified!\n`);
  }
}

runPreflight();
