-- Stores leads from the public contact / membership form on the landing
-- page. Public (anon) clients may only insert; nobody can read, update or
-- delete through the API — submissions are reviewed via the Supabase
-- dashboard by an authenticated admin.

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or char_length(phone) <= 40),
  interest text not null default 'contacto_general'
    check (interest in ('membresia', 'contacto_general')),
  message text check (message is null or char_length(message) <= 2000),
  source text not null default 'landing_page'
);

alter table public.contact_submissions enable row level security;

create policy "Anyone can submit the contact form"
  on public.contact_submissions
  for insert
  to anon
  with check (true);
