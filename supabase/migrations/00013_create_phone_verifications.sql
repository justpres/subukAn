-- Migration 00013: Serverless OTP Persistence
-- Provides durable phone verification tracking across serverless instances

CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT phone_verifications_user_id_key UNIQUE (user_id)
);

-- Index for lookup performance by user_id
CREATE INDEX IF NOT EXISTS idx_phone_verifications_user_id ON public.phone_verifications(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

-- Only service role has access to read/write verification records directly
DROP POLICY IF EXISTS "Service role manages phone verifications" ON public.phone_verifications;
CREATE POLICY "Service role manages phone verifications"
  ON public.phone_verifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
