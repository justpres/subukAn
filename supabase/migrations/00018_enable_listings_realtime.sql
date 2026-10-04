-- Migration 00018: Enable Realtime for Listings
-- Description: Adds public.listings to the supabase_realtime publication and configures full replica identity.

alter publication supabase_realtime add table public.listings;
alter table public.listings replica identity full;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
