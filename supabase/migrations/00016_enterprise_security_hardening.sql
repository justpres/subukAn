-- Migration 00016: Enterprise Security Hardening & Zero-Trust Invariants

-- ============================================================================
-- 1. PROFILES COLUMN-LEVEL BOPLA PROTECTION & ROLE IMMUTABILITY TRIGGER
-- ============================================================================

create or replace function public.protect_profile_invariants()
returns trigger
security definer
set search_path = public
language plpgsql as $$
begin
  if auth.role() != 'service_role' then
    if new.is_admin is distinct from old.is_admin then
      raise exception 'Administrative privilege escalation prohibited.';
    end if;
    if new.phone_verified is distinct from old.phone_verified then
      raise exception 'Direct phone verification tampering prohibited.';
    end if;
    if old.role is not null and new.role is distinct from old.role then
      raise exception 'Role switching is prohibited. Account role is immutable.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_invariants on public.profiles;
create trigger trg_protect_profile_invariants
  before update on public.profiles
  for each row
  execute function public.protect_profile_invariants();

-- ============================================================================
-- 2. SCOPED READ ACCESS ON PUBLIC.PROFILES (COUNTERPARTY-ONLY VISIBILITY)
-- ============================================================================

-- Helper function to verify profile counterparty relationship without RLS recursion
create or replace function public.check_is_profile_counterparty(target_profile_id uuid, viewer_id uuid)
returns boolean
security definer
set search_path = public
language plpgsql as $$
begin
  -- Check if viewer is an admin
  if exists (select 1 from public.profiles where id = viewer_id and is_admin = true) then
    return true;
  end if;

  -- Check if viewer is the poster of a listing where target_profile submitted
  if exists (
    select 1
    from public.submissions s
    join public.listings l on l.id = s.listing_id
    where s.tester_id = target_profile_id and l.poster_id = viewer_id
  ) then
    return true;
  end if;

  -- Check if viewer is a tester who submitted to a listing created by target_profile
  if exists (
    select 1
    from public.submissions s
    join public.listings l on l.id = s.listing_id
    where l.poster_id = target_profile_id and s.tester_id = viewer_id
  ) then
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.check_is_profile_counterparty(uuid, uuid) to public;

drop policy if exists "Public read profiles" on public.profiles;
drop policy if exists "Scoped read profiles" on public.profiles;

create policy "Scoped read profiles"
  on public.profiles for select
  using (
    auth.uid() = id
    or public.check_is_profile_counterparty(id, auth.uid())
  );

-- ============================================================================
-- 3. NOTIFICATIONS INSERTION GUARD (SERVICE-ROLE & COUNTERPARTIES ONLY)
-- ============================================================================

drop policy if exists "Authenticated users can insert notifications" on public.notifications;
drop policy if exists "Service role or counterparties can insert notifications" on public.notifications;

create policy "Service role or counterparties can insert notifications"
  on public.notifications for insert
  with check (
    auth.role() = 'service_role'
    or auth.uid() = user_id
    or public.check_is_profile_counterparty(user_id, auth.uid())
  );

-- ============================================================================
-- 4. SUBMISSIONS ANTI-SELF-DEALING TRIGGER (POSTER != TESTER)
-- ============================================================================

create or replace function public.prevent_self_dealing_submission()
returns trigger
security definer
set search_path = public
language plpgsql as $$
declare
  listing_poster uuid;
begin
  select poster_id into listing_poster from public.listings where id = new.listing_id;
  if listing_poster is not null and listing_poster = new.tester_id then
    raise exception 'Self-dealing prohibited: posters cannot submit to their own listings.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_dealing on public.submissions;
create trigger trg_prevent_self_dealing
  before insert on public.submissions
  for each row
  execute function public.prevent_self_dealing_submission();

-- ============================================================================
-- 5. CONCURRENCY SLOT LIMIT ENFORCEMENT WITH ROW LOCK
-- ============================================================================

create or replace function public.enforce_submission_slot_limit()
returns trigger
security definer
set search_path = public
language plpgsql as $$
declare
  max_slots integer;
  current_active integer;
begin
  -- Lock the target listing row to serialize concurrent slot claiming attempts
  select slots_count into max_slots
  from public.listings
  where id = new.listing_id
  for update;

  if max_slots is null then
    raise exception 'Listing does not exist.';
  end if;

  select count(*) into current_active
  from public.submissions
  where listing_id = new.listing_id
  and status not in ('expired');

  if current_active >= max_slots then
    raise exception 'All tester slots for this campaign have already been claimed.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_submission_slot_limit on public.submissions;
create trigger trg_enforce_submission_slot_limit
  before insert on public.submissions
  for each row
  execute function public.enforce_submission_slot_limit();

-- ============================================================================
-- 6. SUBMISSIONS STATE & AUTO-RELEASE INTEGRITY TRIGGER
-- ============================================================================

create or replace function public.guard_submission_state_transitions()
returns trigger
security definer
set search_path = public
language plpgsql as $$
declare
  listing_poster uuid;
  rev_window integer;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  select poster_id, review_window_minutes into listing_poster, rev_window
  from public.listings
  where id = new.listing_id;

  -- Only poster (or service_role) can transition status to 'approved' or 'rejected'
  if new.status in ('approved', 'rejected') and (auth.uid() is null or auth.uid() != listing_poster) then
    raise exception 'Unauthorized status transition: only the campaign creator can approve or reject submissions.';
  end if;

  -- Prevent testers from altering auto_release_at directly
  if auth.uid() = new.tester_id and auth.uid() != listing_poster then
    if new.status = 'pending_review' and old.status = 'in_progress' then
      -- Automatically compute auto_release_at server-side based on listing review window
      new.auto_release_at := now() + (rev_window || ' minutes')::interval;
    elsif new.auto_release_at is distinct from old.auto_release_at then
      raise exception 'Direct tampering with auto_release_at timestamp is prohibited.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_submission_state_transitions on public.submissions;
create trigger trg_guard_submission_state_transitions
  before update on public.submissions
  for each row
  execute function public.guard_submission_state_transitions();
