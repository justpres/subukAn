| version | 1.0 |
| name | production-runbook |
| description | Step-by-step operations runbook for deploying and operating the SubukAn platform in live production. |

# 🚀 SubukAn Production Deployment & Operations Runbook

This document provides the canonical checklist for provisioning infrastructure, configuring 3rd-party financial gateways, and safely launching SubukAn to public users in the Philippines.

---

## 1. Cloud Infrastructure Architecture

```mermaid
graph LR
    User[Tester / Poster] --> Vercel[Vercel Serverless Next.js 14]
    Vercel --> SupabaseDB[(Supabase PostgreSQL + RLS)]
    Vercel --> SupabaseStorage[Supabase Storage: task-attachments]
    Vercel --> PayMongo[PayMongo Gateway: Cards / GCash Escrow & Disbursements]
    Vercel --> Semaphore[Semaphore API: SMS OTP Dispatch]
    VercelCron[Vercel Daily Cron: 0 16 * * * (Midnight PHT)] --> Vercel
    GitHubCron[GitHub Actions Cron: */30 * * * * (30-min Payouts)] --> Vercel
```

---

## 2. Step-by-Step Setup Guide

### Step 1: Supabase Production Project
1. **Create Project**: Create a new project on [Supabase.com](https://supabase.com) in the Singapore (`ap-southeast-1`) region for minimum latency to the Philippines.
2. **Execute Migrations**: Open the **SQL Editor** and run the migration files in numerical order:
   - `supabase/migrations/00001_initial_schema.sql`
   - `supabase/migrations/00002_timed_display_tasks.sql`
   - `supabase/migrations/00003_demographics_and_quick_impression.sql`
   - `supabase/migrations/00004_backlog_features.sql`
   - `supabase/migrations/00005_fix_rls_recursion.sql`
   - `supabase/migrations/00006_add_listings_demographics.sql`
   - `supabase/migrations/00007_rename_comment_columns.sql`
   - `supabase/migrations/00008_add_site_url.sql`
   - `supabase/migrations/00009_reload_schema_cache.sql`
   - `supabase/migrations/00010_add_payment_settings.sql`
   - `supabase/migrations/00011_secure_payment_settings.sql`
   - `supabase/migrations/00012_remedy_security_and_schema_gaps.sql`
   - `supabase/migrations/00013_create_phone_verifications.sql`
   - `supabase/migrations/00014_add_admin_and_dispute_resolution.sql`
   - `supabase/migrations/00015_add_dual_rail_payments.sql`
   - `supabase/migrations/00016_enterprise_security_hardening.sql`
   - `supabase/migrations/00017_add_profile_extended_settings.sql`
3. **Storage Bucket Provisioning**:
   - Navigate to **Storage** in the Supabase Dashboard.
   - Click **New Bucket**, name it `task-attachments`.
   - Set it to **Private** (authenticated/signed URL access only).
   - Set Allowed MIME types: `video/webm`, `video/mp4`, `image/png`, `image/jpeg`.
   - Set Max File Size limit: `100MB`.
4. **Auth Settings**:
   - Under **Authentication -> URL Configuration**, set **Site URL** to `https://yourdomain.com` (or production Vercel domain).
   - Add `https://yourdomain.com/auth/callback` to **Redirect URLs**.

---

### Step 2: PayMongo Philippines Gateway Setup
1. **Merchant Verification**: Ensure your PayMongo account is approved for live transactions.
2. **Enable Disbursements API**:
   - Request activation of the **Disbursements API** via your PayMongo dashboard or account manager to allow automated GCash payouts.
   - Top up your PayMongo merchant balance (e.g. ₱5,000) for initial tester payouts.
3. **Register Live Webhook**:
   - Go to **Developers -> Webhooks** in the PayMongo Dashboard.
   - Add endpoint URL: `https://yourdomain.com/api/webhooks/paymongo`
   - Select events:
     - `link.payment.paid`
     - `payment.paid`
     - `payment.intent.succeeded`
     - `payout.paid`
     - `disbursement.paid`
   - Copy the generated **Webhook Signing Secret** (`whsec_...`).

---

### Step 3: Semaphore SMS Gateway Setup
1. Create an account at [Semaphore.co](https://semaphore.co).
2. Top up a prepaid SMS balance (e.g. ₱200 for ~400 SMS messages).
3. Request Sender Name registration (default or `Subukan`).
4. Copy your `SMS_API_KEY`.

---

### Step 4: Vercel Production Environment Variables

In your Vercel Project Settings -> **Environment Variables**, configure the following:

| Variable Name | Description | Example Value |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | `https://xyzproject.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Public Anon Key | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret | `eyJhbGci...` |
| `PAYMONGO_SECRET_KEY` | Live PayMongo Secret Key | `sk_live_...` |
| `PAYMONGO_WEBHOOK_SIGNING_SECRET` | Live Webhook Signing Secret | `whsec_...` |
| `SMS_API_KEY` | Semaphore SMS API Key | `abc123456...` |
| `SMS_SENDER_NAME` | SMS Sender Header | `Subukan` |
| `CRON_SECRET` | Auto-Release Cron Shared Secret Token (timing-safe Bearer auth) | `super_secure_random_uuid` |
| `ADMIN_USER_IDS` | Comma-separated admin User IDs | `uuid-1,uuid-2` |
| `ADMIN_EMAILS` | Comma-separated admin email addresses | `admin@yourdomain.com` |

> [!IMPORTANT]
> **Supabase Project URL vs REST URL Format**:
> When copying the URL from **Supabase Dashboard -> Settings -> API**, copy the root **Project URL** (`https://xyzproject.supabase.co`).
> Do **NOT** copy the **REST URL** (`https://xyzproject.supabase.co/rest/v1`).
> Appending `/rest/v1`, `/auth/v1`, or trailing slashes directs authentication calls to PostgREST instead of GoTrue, triggering `PGRST125: Invalid path specified in request URL`. Our client sanitizes this automatically, but maintaining the canonical base URL in your environment settings is best practice.

---

### Step 5: Escrow Auto-Release Automation & GitHub Secrets

#### 1. Vercel Hobby Limit & Dual-Cron Architecture
- **Vercel Hobby 1-Cron/Day Limit**: Vercel accounts on the Hobby tier enforce a hard platform limit of **1 cron invocation per day**. Deploying a configuration with a frequency greater than once daily (e.g. hourly `0 * * * *` or `*/30 * * * *`) fails during deployment with:
  ```
  Error: The Hobby plan only supports 1 cron job per day. Upgrade to Pro for more frequent cron jobs.
  ```
- **Solution 2 (Production Hybrid Automation)**:
  1. **`vercel.json`**: Configured to run once daily at 16:00 UTC (`0 16 * * *`, corresponding to 00:00 Philippine Standard Time / midnight PHT). This adheres strictly to Vercel Hobby rules and acts as a built-in safety net.
  2. **GitHub Actions Workflow (`.github/workflows/auto-release-cron.yml`)**: Runs every 30 minutes (`cron: '*/30 * * * *'`) using free GitHub Actions scheduled runners. It executes a secure HTTPS GET request to the `/api/cron/auto-release` endpoint with constant-time Bearer token verification.
  3. **Manual Trigger Support**: Includes `workflow_dispatch:` allowing operators to trigger escrow auto-release on demand directly from the GitHub Actions dashboard.

#### 2. Required GitHub Repository Secrets
In your GitHub repository, navigate to **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**, and configure:

| Secret Name | Description | Example Value |
| :--- | :--- | :--- |
| `PRODUCTION_DOMAIN` | The public hostname where SubukAn is hosted on Vercel. Protocol (`https://`) and trailing slashes are automatically sanitized. | `subukan.vercel.app` or `subukan.ph` |
| `CRON_SECRET` | The exact shared secret matching the `CRON_SECRET` configured in Vercel Environment Variables. | `super_secure_random_uuid` |

#### 3. Execution & Idempotency Safeguards
- The workflow validates that both secrets exist before making network calls.
- The `curl` request uses connection timeouts (15s), maximum execution limit (60s), and automatic retries (2 attempts) for network resilience.
- The workflow evaluates the returned HTTP status code and fails with an explicit error annotation if status code != 200.
- **Strict Idempotency**: The API route hashes `sha256(submission_id:tester_id)` as the idempotency key in the `payouts` ledger table. Even if the GitHub Actions cron and Vercel daily cron trigger at the same minute, the database uniquely deduplicates payouts and prevents double disbursement.

---

### Step 6: Automated Preflight Health Check

Before opening the site to real users, run the automated health check from your terminal:

```bash
node scripts/preflight-check.mjs
```

Ensure all items return `[✔ PASS]` and the result shows `RESULT: GO FOR PRODUCTION`.

---

## 3. Closed Pilot Verification Protocol (3–5 Testers)

Prior to a public launch marketing push:

1. **Post a Test Campaign**: Post a pilot campaign with a rate of ₱50 per tester and 3 slots.
2. **Escrow Funding**: Pay the ₱150 escrow commitment using a real debit/credit card or GCash.
3. **Tester Onboarding**: Have 3 real testers register, verify their GCash numbers via SMS OTP, accept the NDA, and submit test evidence with screen recordings.
4. **Disbursement Execution**: Approve a submission and confirm that ₱50 arrives in the tester's GCash wallet.
5. **Dispute Test**: Reject 1 submission, submit a dispute from the tester dashboard, and use `/dashboard/admin/disputes` to arbitrate the ticket.
