-- Admin-facing soft delete for user accounts: "deactivate" means
-- profiles.status = 'inactive', already the exact mechanism every
-- protected entry point in this app checks (requireUser/requireAdmin/
-- requireChatAdmin, chat's sendMessage/getOrCreateConversation/
-- markConversationRead/getMyUnreadCount, is_admin()) — no new column,
-- no new "disabled"/"banned" flag. Nothing in auth.users is ever
-- touched: the account, its email, its historical orders/payments/
-- conversations/messages all remain exactly as they are. This is
-- deliberately a single, generic status-setter (not two near-duplicate
-- functions) so "never deactivate yourself, never deactivate another
-- admin" is enforced in exactly one place.
create or replace function public.admin_set_user_status(p_target_user_id uuid, p_new_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_target_role text;
  v_target_status text;
begin
  if p_new_status not in ('active', 'inactive') then
    raise exception 'invalid_status';
  end if;

  if v_actor_id is null or not public.is_admin(v_actor_id) then
    raise exception 'not_authorized';
  end if;

  if v_actor_id = p_target_user_id then
    raise exception 'cannot_target_self';
  end if;

  select role, status into v_target_role, v_target_status
  from public.profiles
  where id = p_target_user_id;

  if v_target_role is null then
    raise exception 'user_not_found';
  end if;

  -- Admins can never be deactivated through this function, by anyone —
  -- not "no other admin may deactivate THIS admin", a blanket rule, so
  -- there's no separate superadmin concept to invent or maintain.
  if p_new_status = 'inactive' and v_target_role = 'admin' then
    raise exception 'cannot_target_admin';
  end if;

  -- Idempotent: a double-click (or two admins acting at once) that
  -- lands on the same target status is a no-op, not an error, and never
  -- writes a second audit_log row for the same transition.
  if v_target_status = p_new_status then
    return jsonb_build_object('changed', false, 'status', v_target_status);
  end if;

  update public.profiles
  set status = p_new_status
  where id = p_target_user_id;

  insert into public.audit_log (actor_id, action, resource_type, resource_id, metadata)
  values (
    v_actor_id,
    case when p_new_status = 'inactive' then 'user_deactivated' else 'user_reactivated' end,
    'profile',
    p_target_user_id::text,
    jsonb_build_object('previous_status', v_target_status, 'new_status', p_new_status)
  );

  return jsonb_build_object('changed', true, 'status', p_new_status);
end;
$$;

revoke all on function public.admin_set_user_status(uuid, text) from public;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;
