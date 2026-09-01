-- Stores the OAuth access token obtained from Tiendanube's authorization
-- code exchange, keyed by the store's own id (their `user_id`, which
-- their token response also echoes back as `store_id` — see
-- src/app/api/tiendanube/oauth/callback/route.ts).
--
-- Deliberately NOT stored in a Vercel env var: a serverless function
-- cannot write env vars for its own deployment at runtime, so the only
-- place a token obtained dynamically (from an admin completing OAuth)
-- can actually be persisted is here.
--
-- RLS: enabled with ZERO policies for any client role, on purpose — not
-- even admins get a SELECT policy through the session client. The only
-- way to read or write this table is the service-role client (bypasses
-- RLS entirely), used exclusively by the OAuth callback route and by
-- src/lib/tiendanube/client.ts — both server-only. This is the same
-- "no client policy at all" pattern already used for `audit_log`'s
-- writes and `payment_events`.
create table public.tiendanube_connections (
  id uuid primary key default gen_random_uuid(),
  store_id text not null unique,
  access_token text not null,
  token_type text not null default 'bearer',
  scope text,
  connected_by uuid references auth.users(id),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tiendanube_connections enable row level security;
-- No policies added — every request from the anon/authenticated roles is
-- denied by default once RLS is enabled with no matching policy.

create index tiendanube_connections_store_id_idx on public.tiendanube_connections(store_id);
