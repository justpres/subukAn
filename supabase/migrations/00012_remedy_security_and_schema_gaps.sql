-- Migration 00012: Remedy Security & Schema Gaps
-- 1. Fix poster_payment_settings missing INSERT RLS policy
create policy "Users can insert own payment settings"
  on public.poster_payment_settings for insert
  with check (auth.uid() = id);

-- 2. Create Notifications Table & RLS Policies
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('submission_approved', 'submission_rejected', 'dispute_filed', 'payout_processed', 'listing_filled', 'system')),
  title text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "Users can delete own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

create policy "Authenticated users can insert notifications"
  on public.notifications for insert
  with check (auth.uid() is not null);

create index if not exists idx_notifications_user_created 
  on public.notifications(user_id, created_at desc);

-- 3. Add Missing Columns to Submissions & Update Status Check Constraint
alter table public.submissions drop constraint if exists submissions_status_check;
alter table public.submissions add constraint submissions_status_check 
  check (status in ('in_progress', 'pending_review', 'approved', 'rejected', 'disputed', 'expired'));

alter table public.submissions add column if not exists dispute_reason text;
alter table public.submissions add column if not exists dispute_explanation text;
alter table public.submissions add column if not exists rejection_attachment text;

-- 4. Add Missing Image URL Columns to Tasks Table
alter table public.tasks add column if not exists image_url text;
alter table public.tasks add column if not exists screenshot_url text;

-- 5. Fix submission_comments RLS policy after column rename (sender_id -> user_id)
drop policy if exists "Poster or tester involved can insert comments" on public.submission_comments;
drop policy if exists "Poster or tester involved can view comments" on public.submission_comments;

create policy "Poster or tester involved can insert comments"
  on public.submission_comments for insert
  with check (
    auth.uid() = user_id and exists (
      select 1 from public.submissions s
      where s.id = submission_comments.submission_id
      and (s.tester_id = auth.uid() or public.check_is_listing_poster(s.listing_id, auth.uid()))
    )
  );

create policy "Poster or tester involved can view comments"
  on public.submission_comments for select
  using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_comments.submission_id
      and (s.tester_id = auth.uid() or public.check_is_listing_poster(s.listing_id, auth.uid()))
    )
  );
