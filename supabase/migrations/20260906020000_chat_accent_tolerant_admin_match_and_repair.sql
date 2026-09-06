-- Two fixes found auditing a real "Ariel's replies never reach the user"
-- report:
--
-- 1) is_chat_admin() / getChatAdminId() (TS) match first_name/last_name
--    with plain-ASCII ilike ('ariel%' / '%gomez%'). If Ariel's real name
--    is ever stored with the correct Spanish accent ("Gómez"), ilike
--    against 'gomez' does NOT match it (Postgres ilike is
--    case-insensitive, not accent-insensitive) — silently breaking chat
--    RLS access and push recipient resolution with no error anywhere.
--    Today's actual stored data happens to be unaccented ASCII, so this
--    isn't the active cause of the reported bug, but it's a real latent
--    one the audit surfaced, worth closing now rather than waiting for
--    someone to fix a typo in their name and lose chat access silently.
--    Fixed with translate() (no extension dependency, unlike unaccent) —
--    covers the Spanish vowels that actually appear in real names here.
--
-- 2) A NEW get_chat_admin_id() SECURITY DEFINER function replaces the
--    hand-duplicated ilike query previously living in
--    src/lib/chat/chat-admin-lookup.ts — that TS copy and this SQL
--    function used to be two independently-maintained implementations of
--    the identical "who is Ariel" rule (in sync only by careful manual
--    duplication, per the audit). Now there is exactly one source of
--    truth for the lookup, reused by RPC.
create or replace function public.fold_es_accents(txt text)
returns text
language sql
immutable
as $$
  select translate(txt, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN');
$$;

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
      and public.fold_es_accents(first_name) ilike 'ariel%'
      and public.fold_es_accents(last_name) ilike '%gomez%'
  );
$$;

create or replace function public.get_chat_admin_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.profiles
  where role = 'admin'
    and status = 'active'
    and public.fold_es_accents(first_name) ilike 'ariel%'
    and public.fold_es_accents(last_name) ilike '%gomez%'
  limit 1;
$$;

revoke all on function public.get_chat_admin_id() from public, anon, authenticated;
grant execute on function public.get_chat_admin_id() to service_role;

-- Data repair: real messages Ariel wrote for Benjamín while accidentally
-- inside HIS OWN /chat conversation (nothing stopped an is_chat_admin
-- account from opening /chat like any regular user and typing there,
-- since it's a different route than /admin/chat — now fixed in the app
-- code too, see chat/page.tsx and getOrCreateConversation()). Those rows
-- were stored with sender_role='user' (correct for "the owner of THIS
-- conversation", which was literally Ariel in his own one) but never
-- reachable by Benjamín, who has no way to discover a conversation he
-- doesn't own and isn't the admin of. Moves them into Benjamín's real,
-- existing conversation with the correct sender_role='admin', preserving
-- original timestamps so chronological order stays accurate, then
-- removes the now-empty stray conversation. Written generically (by
-- name-matched real accounts, not hardcoded ids) so it's a no-op if this
-- has already been fixed by hand or never existed in a given environment.
do $$
declare
  v_ariel_id uuid;
  v_benjamin_id uuid;
  v_real_conversation_id uuid;
  v_stray_conversation_id uuid;
begin
  select id into v_ariel_id from public.profiles
  where role = 'admin' and status = 'active'
    and public.fold_es_accents(first_name) ilike 'ariel%'
    and public.fold_es_accents(last_name) ilike '%gomez%'
  limit 1;

  select id into v_benjamin_id from public.profiles
  where status = 'active'
    and public.fold_es_accents(first_name) ilike 'benjamin%'
    and public.fold_es_accents(last_name) ilike '%gomez%'
  limit 1;

  if v_ariel_id is null or v_benjamin_id is null then
    return;
  end if;

  select id into v_real_conversation_id from public.conversations where user_id = v_benjamin_id;
  select id into v_stray_conversation_id from public.conversations where user_id = v_ariel_id;

  if v_real_conversation_id is null or v_stray_conversation_id is null then
    return;
  end if;

  update public.messages
  set conversation_id = v_real_conversation_id,
      sender_role = 'admin'
  where conversation_id = v_stray_conversation_id
    and sender_id = v_ariel_id;

  update public.conversations
  set last_message_at = greatest(coalesce(last_message_at, 'epoch'::timestamptz), (
        select max(created_at) from public.messages where conversation_id = v_real_conversation_id
      )),
      updated_at = now(),
      admin_id = coalesce(admin_id, v_ariel_id)
  where id = v_real_conversation_id;

  -- Only remove the stray conversation if the move above accounted for
  -- every message in it — never silently cascade-delete something
  -- unexpected still sitting there.
  if not exists (select 1 from public.messages where conversation_id = v_stray_conversation_id) then
    delete from public.conversations where id = v_stray_conversation_id;
  end if;
end $$;
