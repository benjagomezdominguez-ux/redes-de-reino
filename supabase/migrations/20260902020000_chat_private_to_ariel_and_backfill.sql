-- Two changes, both from explicit real-world feedback after live use:
--
-- 1. DATA REPAIR: three real messages sent before the ownership-based
--    sender_role fix (an earlier commit this session) were stamped by
--    the old logic — "sender_role = admin if this account holds the
--    admin role", regardless of who owned the conversation. Benjamin
--    Gómez (an admin) messaged Ariel through his own /chat conversation;
--    his own message got wrongly stamped 'admin' instead of 'user',
--    so on reload every message in that conversation rendered as if it
--    came from "the other side" — none of Benjamin's own messages were
--    ever highlighted as his. This recomputes sender_role for every
--    existing message from the real, authoritative fact already in the
--    database — who actually owns the conversation — the exact same
--    rule the fixed application code now uses for new messages. Only
--    rows that would actually change are touched.
update public.messages m
set sender_role = case when m.sender_id = c.user_id then 'user' else 'admin' end
from public.conversations c
where c.id = m.conversation_id
  and m.sender_id is not null
  and m.sender_role <> (case when m.sender_id = c.user_id then 'user' else 'admin' end);

-- 2. ACCESS CHANGE: the chat is private to Ariel Gómez specifically —
--    explicitly requested to hold even against OTHER admins (e.g. the
--    site's original admin/owner account, which is also role='admin').
--    Matched by name against the real profiles data, same "find this
--    one real person" pattern as findBenjaminGomezEmail() in the
--    WhatsApp system (src/lib/whatsapp/scheduler.ts) — never a
--    hardcoded UUID. Mirrored exactly by isChatAdmin() in
--    src/lib/chat/is-chat-admin.ts, used by every TS-side check — keep
--    both in sync if this ever changes.
create or replace function public.is_chat_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = uid
      and role = 'admin'
      and status = 'active'
      and first_name ilike 'ariel%'
      and last_name ilike '%gomez%'
  );
$$;

revoke all on function public.is_chat_admin(uuid) from public;
grant execute on function public.is_chat_admin(uuid) to authenticated;

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
      and (c.user_id = auth.uid() or public.is_chat_admin(auth.uid()))
  );
$$;

drop policy "Users see their own conversation, admins see all" on public.conversations;
create policy "Users see their own conversation, only Ariel sees all"
  on public.conversations
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_chat_admin(auth.uid()));

drop policy "Only admins can see push subscriptions" on public.push_subscriptions;
create policy "Only Ariel can see push subscriptions"
  on public.push_subscriptions
  for select
  to authenticated
  using (public.is_chat_admin(auth.uid()));
