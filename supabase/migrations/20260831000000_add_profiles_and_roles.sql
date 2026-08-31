-- Auth roles: a `profiles` row per user, carrying role/status, plus the
-- RLS + trigger machinery needed so that role can never be self-escalated
-- from the client — see rules 2, 13, 14, 31 of the auth prompt.
--
-- Design notes:
-- * profiles.id === auth.users.id (1:1), created automatically by a
--   trigger on auth.users insert — the client never inserts this row.
-- * is_admin() is a SECURITY DEFINER helper. Because it's owned by the
--   migration role (which owns `profiles` and therefore bypasses RLS on
--   it), calling it from another table's RLS policy does not recurse into
--   profiles' own RLS — this is Supabase's documented pattern for
--   role-membership checks. See:
--   https://supabase.com/docs/guides/database/postgres/row-level-security#policies-with-security-definer-functions
-- * The trigger only reverts role/status changes when the request came
--   through the API as an authenticated end user (auth.role() =
--   'authenticated') and that user isn't already an admin. Direct SQL
--   (migrations, SQL editor) and the service_role key are already
--   trusted, privileged contexts and are intentionally left alone — that
--   is the only way to bootstrap the very first admin (see README).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  first_name text,
  last_name text,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'inactive'))
);

alter table public.profiles enable row level security;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'admin' and status = 'active'
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

create policy "Users view own profile, admins view all"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id or public.is_admin(auth.uid()));

create policy "Users update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
-- No insert/delete policy for the client: rows are created only by the
-- handle_new_user() trigger below and removed only via the auth.users
-- cascade.

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin(auth.uid()) then
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$;

create trigger protect_profile_privileges_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- Creates the profile row automatically on signup. first_name/last_name
-- come from the signUp() call's options.data (Supabase stores that as
-- raw_user_meta_data) — never trusted for `role`, which always takes the
-- column default ('user') here regardless of what metadata is sent.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin read access on top of the existing "own data only" policies from
-- the books-store migration (multiple permissive policies on the same
-- command are OR'd together in Postgres RLS, so this purely adds access,
-- it never narrows the existing user-scoped policies).
create policy "Admins can view all orders"
  on public.orders
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "Admins can view all order items"
  on public.order_items
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "Admins can view all shipping addresses"
  on public.shipping_addresses
  for select
  to authenticated
  using (public.is_admin(auth.uid()));
