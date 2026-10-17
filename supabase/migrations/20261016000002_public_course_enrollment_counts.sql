-- The public course list/detail pages show "N personas inscriptas" as a
-- simple social-proof number — course_enrollments itself deliberately
-- has no public SELECT policy at all (not even "my own row" is visible
-- to anyone but the row's own owner or an admin), so there's no way for
-- an anonymous or ordinary signed-in visitor to count rows in it
-- directly. This is a narrow, read-only, SECURITY DEFINER function that
-- returns only an aggregate count per visible course — never who, never
-- any row contents, and only for courses already public (published or
-- closed) in the first place.
create or replace function public.get_public_course_enrollment_counts()
returns table(course_id uuid, enrolled_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select ce.course_id, count(*)
  from public.course_enrollments ce
  join public.courses c on c.id = ce.course_id
  where ce.status = 'active' and c.status in ('published', 'closed')
  group by ce.course_id;
$$;

revoke all on function public.get_public_course_enrollment_counts() from public;
grant execute on function public.get_public_course_enrollment_counts() to anon, authenticated;
