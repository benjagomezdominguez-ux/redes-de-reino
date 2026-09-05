-- Devotionals: a small content library administered exclusively by
-- Ariel Gómez (the same real person already gated by is_chat_admin() for
-- the chat system — reused here as-is rather than inventing a second
-- "is this admin allowed" concept for the same one person).
create table public.devotionals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  -- Snapshotted at write time, never trusted from the client — always
  -- the real authenticated actor from requireChatAdmin(). on delete set
  -- null so a later account change/deletion can never be blocked by a
  -- devotional row, same rule already applied to messages.sender_id.
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index devotionals_status_published_at_idx on public.devotionals(status, published_at desc);

alter table public.devotionals enable row level security;

-- Public, read-only, published-only — this is the real security
-- boundary for drafts, not just a hidden button: no role (anon,
-- authenticated, or otherwise) can ever select a draft row through this
-- policy, and there is no other SELECT policy that would let one
-- through. All writes (create/update/publish/unpublish/delete) go
-- through the service-role client inside requireChatAdmin()-gated
-- Server Actions — no insert/update/delete policy exists for any client
-- role, exactly like every other admin-only table in this project.
create policy "Anyone can view published devotionals"
  on public.devotionals
  for select
  to public
  using (status = 'published');
