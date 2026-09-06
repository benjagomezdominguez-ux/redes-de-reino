-- General in-app + push notifications for ANY registered user (Fase 14-16
-- of the "modificación integral" prompt) — distinct from the chat-only
-- NotificationBell/push_subscriptions-for-Ariel system, which stays
-- exactly as it is. First consumer: "el pastor Ariel publicó un nuevo
-- devocional", but the shape is generic (a `type` + optional `link_path`)
-- so a future notification kind doesn't need a second table.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('devotional_published')),
  title text not null,
  body text,
  link_path text,
  -- The id of whatever this notification is about (e.g. a devotional).
  -- Paired with (user_id, type) in the unique constraint below so the
  -- same event can never notify the same user twice (idempotency, rule
  -- 16), even if the publish action were somehow called twice for the
  -- same devotional.
  resource_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, type, resource_id)
);

create index notifications_user_id_created_at_idx on public.notifications(user_id, created_at desc);
create index notifications_user_id_unread_idx on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;

-- SELECT only, own rows — same pattern as every other user-scoped table
-- in this project. No INSERT/DELETE policy for any client role: only the
-- service-role client (inside the devotional-publish Server Action) ever
-- creates a row. No plain UPDATE policy either — marking a notification
-- read goes through mark_notification_read() below (SECURITY DEFINER),
-- the same "constrained write via RPC" pattern already used for orders
-- payments (submit_transfer_proof) rather than a client UPDATE policy
-- that would need extra machinery to restrict which columns are
-- writable.
create policy "Users see only their own notifications"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
  set read_at = now()
  where id = p_notification_id
    and user_id = auth.uid()
    and read_at is null;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;
