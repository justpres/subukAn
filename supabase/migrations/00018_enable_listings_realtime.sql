-- Migration 00018: Enable Realtime for Listings
-- Description: Adds public.listings to the supabase_realtime publication and configures full replica identity.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'listings'
  ) THEN
    alter publication supabase_realtime add table public.listings;
  END IF;
END $$;

alter table public.listings replica identity full;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
