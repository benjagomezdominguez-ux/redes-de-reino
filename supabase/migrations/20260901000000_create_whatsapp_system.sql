-- WhatsApp broadcast system: admin-managed groups (distribution lists),
-- monthly campaigns of 4 scheduled messages each, sent one at a time via
-- the official WhatsApp Business Platform (Meta Cloud API) — never
-- WhatsApp Web automation, scraping, or any unofficial method.
--
-- IMPORTANT — read before touching anything that sends: Meta's official
-- WhatsApp Business Platform has NO mechanism to post into a WhatsApp
-- Group chat. That capability is not exposed to any Business API partner
-- at any tier — the only ways to post into an actual Group chat are
-- WhatsApp Web automation / unofficial libraries, both explicitly
-- forbidden by this project's rules. So "grupo" here is a distribution
-- list of individual contacts (E.164 phone numbers); the scheduler fans
-- each scheduled message out as one official, individual Cloud API send
-- per contact in the group. See README for the full explanation.

create table public.whatsapp_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.whatsapp_groups(id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  display_name text,
  created_at timestamptz not null default now(),
  unique (group_id, phone_e164)
);

create table public.whatsapp_campaigns (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.whatsapp_groups(id) on delete cascade,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')),
  start_date date not null,
  -- Default 30 days (rule 9), but configurable per campaign — never
  -- hardcoded to a literal "30 days = one month" assumption elsewhere.
  cycle_duration_days integer not null default 30 check (cycle_duration_days > 0),
  end_date date generated always as (start_date + cycle_duration_days) stored,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  paused_by uuid references auth.users(id),
  paused_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancelled_at timestamptz,
  cancel_reason text,
  completed_at timestamptz
);

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.whatsapp_campaigns(id) on delete cascade,
  sequence_position smallint not null check (sequence_position >= 1),
  title text not null,
  body_text text not null,
  image_storage_path text,
  -- Meta requires a pre-approved Message Template for any send that
  -- doesn't fall inside a 24h customer-service session — which a
  -- scheduled monthly broadcast to a cold contact list never does.
  -- When set, the scheduler sends body_text as the template's single
  -- body variable and the image as the template's header media. When
  -- null, it attempts a freeform text+image send, which Meta will only
  -- accept if that specific contact messaged the business first within
  -- the last 24h — see README.
  whatsapp_template_name text,
  whatsapp_template_language text not null default 'es',
  scheduled_date date not null,
  scheduled_time time not null default '18:00',
  status text not null default 'scheduled'
    check (status in ('scheduled', 'processing', 'sent', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (campaign_id, sequence_position)
);

-- One row per (message, contact): the actual send unit, and the source
-- of truth for idempotency (rule 13) — the scheduler only ever sends to
-- a delivery still in 'pending'/'failed' with attempts remaining, so
-- running it twice never sends the same message to the same contact
-- twice, no matter how many times the cron fires.
create table public.whatsapp_message_deliveries (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.whatsapp_messages(id) on delete cascade,
  contact_id uuid not null references public.whatsapp_contacts(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  external_message_id text,
  error_code text,
  error_message text,
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (message_id, contact_id)
);

-- Tracks the "5 days before the cycle ends" email so it's sent at most
-- once per campaign (rule 23) — the unique constraint is what actually
-- enforces that, not application-level care.
create table public.whatsapp_notifications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.whatsapp_campaigns(id) on delete cascade,
  notification_type text not null default 'cycle_ending_soon',
  recipient_email text not null,
  sent_at timestamptz not null default now(),
  unique (campaign_id, notification_type)
);

-- RLS: admin-only, full stop (rule 3/37). Regular authenticated users get
-- no policy at all here, so every query returns empty/denied for them.
-- The scheduler (cron route) and every admin Server Action use the
-- service-role client, which bypasses RLS entirely — same privileged
-- path already used for every other admin write in this project.
alter table public.whatsapp_groups enable row level security;
alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_campaigns enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_message_deliveries enable row level security;
alter table public.whatsapp_notifications enable row level security;

create policy "Admins manage whatsapp groups" on public.whatsapp_groups
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "Admins manage whatsapp contacts" on public.whatsapp_contacts
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "Admins manage whatsapp campaigns" on public.whatsapp_campaigns
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "Admins manage whatsapp messages" on public.whatsapp_messages
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "Admins manage whatsapp deliveries" on public.whatsapp_message_deliveries
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "Admins manage whatsapp notifications" on public.whatsapp_notifications
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create index whatsapp_contacts_group_id_idx on public.whatsapp_contacts(group_id);
create index whatsapp_campaigns_group_id_idx on public.whatsapp_campaigns(group_id);
create index whatsapp_campaigns_status_idx on public.whatsapp_campaigns(status);
create index whatsapp_messages_campaign_id_idx on public.whatsapp_messages(campaign_id);
create index whatsapp_messages_status_idx on public.whatsapp_messages(status);
create index whatsapp_message_deliveries_message_id_idx on public.whatsapp_message_deliveries(message_id);
create index whatsapp_message_deliveries_status_idx on public.whatsapp_message_deliveries(status);

-- Message images: same direct-to-Storage signed-upload architecture as
-- book covers/files and payment proofs (see 20260831140000) — private
-- bucket, size/MIME enforced here since the app never re-sees the bytes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('whatsapp-media', 'whatsapp-media', false, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
