-- Devotional view tracking: lets Ariel see who (which real, registered
-- user) read each devotional, without ever showing that "who viewed"
-- data on the public page. Mirrors public.notifications' own shape and
-- write pattern (a per-user row, written through a SECURITY DEFINER RPC
-- bound to auth.uid(), never a raw client INSERT/UPDATE policy) — see
-- 20260906010000_create_notifications.sql for the same reasoning in
-- detail.
--
-- Design notes:
-- * One row per (devotional, user) — a unique constraint on that pair is
--   what makes "24 personas lo vieron" a count of unique people, never
--   inflated by someone reopening the same devotional 50 times. Reopening
--   only bumps last_viewed_at/view_count on the existing row.
-- * Unlike notifications, there is NO SELECT policy here for any client
--   role at all — not even "see your own row". This is intentionally
--   admin-only statistics, never a per-user "read receipt" a normal
--   visitor has any reason to query. Every admin-facing read in this
--   project already goes through the service-role client instead of a
--   client-facing SELECT policy for exactly this kind of data — see
--   devotional-queries.ts (admin) — and requireChatAdmin() at the call
--   site is the actual gate, same as every other admin read here.
-- * on delete cascade on both FKs: a deleted devotional or a deleted
--   account should never leave orphaned view rows behind.
create table public.devotional_views (
  id uuid primary key default gen_random_uuid(),
  devotional_id uuid not null references public.devotionals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  view_count integer not null default 1,
  created_at timestamptz not null default now(),
  unique (devotional_id, user_id)
);

-- Supports both admin reads this migration's RPC/queries actually run:
-- "every view row for this one devotional, most recent first" (the
-- viewers panel) and "how many unique viewers per devotional" (the list
-- page's count column, one IN-filtered query across many devotionals —
-- devotional_id alone is enough for that one, the composite index below
-- covers it too as a prefix).
create index devotional_views_devotional_id_last_viewed_at_idx
  on public.devotional_views(devotional_id, last_viewed_at desc);
-- Supports the cascade delete when a user account is removed, and any
-- future "devotionals I've read" feature for a given user.
create index devotional_views_user_id_idx on public.devotional_views(user_id);

alter table public.devotional_views enable row level security;
-- No policy is created for any role (anon, authenticated). RLS with zero
-- permissive policies denies all access by default — the only way this
-- table is ever read or written by anything but a migration/the
-- service-role client is through record_devotional_view() below (writes)
-- and the admin/service-role client inside requireChatAdmin()-gated
-- Server Actions (reads, added in devotional-view-queries.ts).

-- Records (or refreshes) one viewer's row for one devotional. Runs as
-- SECURITY DEFINER so it can write to a table with no client-facing
-- INSERT/UPDATE policy, but auth.uid() inside it always evaluates to the
-- REAL calling user's own JWT claim, never something the client could
-- pass in — the same "constrained write via RPC, ownership enforced
-- inside the function body, not trusted from the caller" pattern as
-- mark_notification_read(). A devotional that doesn't exist, or exists
-- but isn't published (e.g. a stale/guessed id, or one unpublished after
-- the page was already open), silently records nothing rather than
-- erroring — the caller (recordDevotionalView() in
-- lib/actions/devotional-views.ts) already never lets this fail the
-- devotional page either way, but this is the real, database-level
-- backstop against ever getting a "view" row for a draft.
create or replace function public.record_devotional_view(p_devotional_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.devotionals
    where id = p_devotional_id and status = 'published'
  ) then
    return;
  end if;

  insert into public.devotional_views (devotional_id, user_id, first_viewed_at, last_viewed_at, view_count)
  values (p_devotional_id, auth.uid(), now(), now(), 1)
  on conflict (devotional_id, user_id)
  do update set last_viewed_at = now(), view_count = public.devotional_views.view_count + 1;
end;
$$;

revoke all on function public.record_devotional_view(uuid) from public;
-- Anonymous visitors can read published devotionals (see
-- 20260905000000_create_devotionals.sql — "to public"), but they have no
-- real identity to attribute a view to, and this project's own rule is
-- never to invent one. Only signed-in users ever call this: the
-- authenticated role is exactly who can genuinely be auth.uid()-bound
-- above.
grant execute on function public.record_devotional_view(uuid) to authenticated;
