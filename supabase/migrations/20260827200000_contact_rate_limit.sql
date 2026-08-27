-- Lets the public form check "have I already submitted recently?" without
-- granting SELECT on contact_submissions (which would let anon enumerate
-- everyone's leads). SECURITY DEFINER runs the check as the function
-- owner, bypassing RLS internally, while only ever returning a boolean.
create or replace function public.can_submit_contact_form(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from contact_submissions
    where email = p_email
      and created_at > now() - interval '5 minutes'
  );
$$;

revoke all on function public.can_submit_contact_form(text) from public;
grant execute on function public.can_submit_contact_form(text) to anon;
