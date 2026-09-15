-- Migration 00014: Admin Role and Dispute Resolution Tracking
-- Adds admin role flag to profiles and resolution metadata to submissions table

-- 1. Add is_admin column to profiles if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 2. Add dispute tracking columns to submissions if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'dispute_resolution_notes'
  ) THEN
    ALTER TABLE public.submissions ADD COLUMN dispute_resolution_notes TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'dispute_resolved_at'
  ) THEN
    ALTER TABLE public.submissions ADD COLUMN dispute_resolved_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'dispute_resolved_by'
  ) THEN
    ALTER TABLE public.submissions ADD COLUMN dispute_resolved_by UUID REFERENCES auth.users(id);
  END IF;
END $$;
