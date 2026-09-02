-- Private chat between any authenticated user and the admin team.
--
-- Deliberate design decision on "identificar a Ariel" (rule 6 of the
-- prompt): rather than a single hardcoded admin recipient, a
-- conversation is visible/answerable by ANY active admin
-- (is_admin(auth.uid())) — exactly the same authorization model already
-- used for every other admin surface in this project (books, orders,
-- WhatsApp, Tiendanube — none of them are siloed per-admin either).
-- `admin_id` still exists as informational "who's currently handling
-- this" metadata (set when an admin first replies), but it is NEVER
-- part of the access-control check — a second admin must still be able
-- to see and answer a conversation even if a different admin touched it
-- first. This is what "no hardcodear un UUID" actually means here: no
-- admin's identity is baked into policy logic at all, only their role.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  admin_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  -- Snapshotted at send time, not derived from a join to profiles.role —
  -- a message stays correctly labeled "sent by an admin" even if that
  -- admin's role is later changed or their account deleted (sender_id
  -- would go null too, per rule 8 of the WhatsApp/Tiendanube work this
  -- session: an attribution FK must never make historical rows
  -- ambiguous or, worse, block deleting the account later).
  sender_role text not null check (sender_role in ('user', 'admin')),
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index conversations_admin_id_idx on public.conversations(admin_id);
create index messages_conversation_id_created_at_idx on public.messages(conversation_id, created_at);
create index messages_conversation_id_unread_idx on public.messages(conversation_id) where read_at is null;

-- Web Push subscriptions — admin-only feature (rule 13-20 of the prompt
-- are explicitly about Ariel/admins receiving OS-level notifications,
-- never mentioned for regular users). One row per browser/device that
-- opted in; `endpoint` is unique so re-subscribing the same
-- browser/device never creates a duplicate.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.push_subscriptions enable row level security;

-- SELECT only — every write (creating a conversation, sending a
-- message, marking as read, saving/removing a push subscription) goes
-- through a Server Action using the service-role client, exactly like
-- every other privileged write in this project (books, WhatsApp,
-- Tiendanube). This is what actually makes rule 10 ("nunca confiar en
-- sender_id/sender_role del frontend") true: the client has no INSERT
-- policy on messages at all, so it cannot write a row directly no matter
-- what it sends — sender_id/sender_role are only ever set by
-- server-determined values inside sendMessage().
create policy "Users see their own conversation, admins see all"
  on public.conversations
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "Users see messages in their own conversation, admins see all"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

create policy "Only admins can see push subscriptions"
  on public.push_subscriptions
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- Realtime: both tables need to be in the publication for
-- postgres_changes subscriptions to fire at all. Full replica identity
-- so UPDATE events (marking read_at) carry the complete new row, not
-- just the primary key.
alter table public.messages replica identity full;
alter table public.conversations replica identity full;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
