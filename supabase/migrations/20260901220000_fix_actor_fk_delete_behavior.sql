-- Every "who did this" column referencing auth.users(id) was declared
-- with no ON DELETE clause, which Postgres defaults to NO ACTION — that
-- silently BLOCKS deleting any user who has ever performed one logged
-- action, anywhere: audit_log, a reviewed payment, a Tiendanube
-- connection, a WhatsApp group/campaign. Deleting such a user through
-- Supabase's Auth admin API fails with an opaque 500 "Database error
-- deleting user" and gives no indication which table is the culprit —
-- discovered for real trying to remove two leftover test admin accounts.
--
-- The fix is ON DELETE SET NULL, not CASCADE: these rows are historical
-- records (an audit entry, a payment review, who created a WhatsApp
-- campaign) that should survive the actor's account being deleted —
-- deleting the account should detach the attribution, never destroy the
-- record, and must never be what blocks the delete in the first place.
-- profiles.id and orders/shipping_addresses.user_id are deliberately left
-- untouched — those already cascade on purpose (a deleted account's own
-- profile/orders going with it is a different, intentional decision, not
-- this bug).

alter table public.audit_log
  drop constraint audit_log_actor_id_fkey,
  add constraint audit_log_actor_id_fkey
    foreign key (actor_id) references auth.users(id) on delete set null;

alter table public.payments
  drop constraint payments_reviewed_by_fkey,
  add constraint payments_reviewed_by_fkey
    foreign key (reviewed_by) references auth.users(id) on delete set null;

alter table public.tiendanube_connections
  drop constraint tiendanube_connections_connected_by_fkey,
  add constraint tiendanube_connections_connected_by_fkey
    foreign key (connected_by) references auth.users(id) on delete set null;

alter table public.whatsapp_groups
  drop constraint whatsapp_groups_created_by_fkey,
  add constraint whatsapp_groups_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.whatsapp_campaigns
  drop constraint whatsapp_campaigns_created_by_fkey,
  add constraint whatsapp_campaigns_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null,
  drop constraint whatsapp_campaigns_paused_by_fkey,
  add constraint whatsapp_campaigns_paused_by_fkey
    foreign key (paused_by) references auth.users(id) on delete set null,
  drop constraint whatsapp_campaigns_cancelled_by_fkey,
  add constraint whatsapp_campaigns_cancelled_by_fkey
    foreign key (cancelled_by) references auth.users(id) on delete set null;
