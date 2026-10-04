-- Migration 00017: Add Profile Extended Settings & Device Type Synchronization
-- Description: Adds location, device_types, and notification_settings columns to public.profiles,
-- and syncs device_type ('mobile', 'desktop', 'both') with device_types array.

-- 1. Add extended profile columns
alter table public.profiles
  add column if not exists location text default 'Metro Manila',
  add column if not exists device_types text[] default '{Android Mobile,Windows PC}'::text[],
  add column if not exists notification_settings jsonb default '{"email_payouts": true, "email_submissions": true, "email_listings": true, "email_disputes": true}'::jsonb;

-- 2. Trigger function to synchronize device_type based on device_types
create or replace function public.sync_profile_device_type()
returns trigger
security definer
set search_path = public
language plpgsql as $$
declare
  has_mobile boolean := false;
  has_desktop boolean := false;
  elem text;
begin
  if new.device_types is not null then
    foreach elem in array new.device_types loop
      if elem ilike '%mobile%' or elem ilike '%android%' or elem ilike '%ios%' or elem ilike '%phone%' then
        has_mobile := true;
      end if;
      if elem ilike '%pc%' or elem ilike '%desktop%' or elem ilike '%windows%' or elem ilike '%mac%' or elem ilike '%laptop%' then
        has_desktop := true;
      end if;
    end loop;

    if has_mobile and has_desktop then
      new.device_type := 'both';
    elsif has_mobile then
      new.device_type := 'mobile';
    elsif has_desktop then
      new.device_type := 'desktop';
    else
      new.device_type := null;
    end if;
  else
    new.device_type := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_device_type on public.profiles;
create trigger trg_sync_profile_device_type
  before insert or update on public.profiles
  for each row
  execute function public.sync_profile_device_type();

-- 3. Backfill device_types and sync device_type for existing records preserving legacy device_type
update public.profiles
set device_types = case
  when device_type = 'mobile' then '{Android Mobile}'::text[]
  when device_type = 'desktop' then '{Windows PC}'::text[]
  else '{Android Mobile,Windows PC}'::text[]
end
where device_types is null;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
