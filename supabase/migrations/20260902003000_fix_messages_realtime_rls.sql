-- Found live: Supabase Realtime's postgres_changes authorization did not
-- deliver a single event for `messages`, even though the channel
-- subscribed successfully with no error — the original SELECT policy on
-- messages used an inline `exists (select ... from conversations ...)`
-- subquery against another RLS-protected table, which Realtime's
-- policy-evaluation path does not reliably support (confirmed
-- empirically: two real logged-in test accounts, message sent, zero
-- realtime delivery, no error surfaced anywhere).
--
-- Fix: same pattern already proven to work everywhere else in this
-- project (is_admin()) — wrap the check in a SECURITY DEFINER function,
-- which runs with the definer's privileges and therefore never needs
-- Realtime to evaluate RLS on a second table mid-policy.
create or replace function public.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (c.user_id = auth.uid() or public.is_admin(auth.uid()))
  );
$$;

revoke all on function public.can_access_conversation(uuid) from public;
grant execute on function public.can_access_conversation(uuid) to authenticated;

drop policy "Users see messages in their own conversation, admins see all" on public.messages;

create policy "Users see messages in their own conversation, admins see all"
  on public.messages
  for select
  to authenticated
  using (public.can_access_conversation(conversation_id));
