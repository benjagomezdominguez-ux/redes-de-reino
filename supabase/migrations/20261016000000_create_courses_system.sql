-- Courses, enrollments, meetings and attendance (password-gated, per
-- meeting, administered by Ariel/authorized admins). Two write patterns,
-- matching the two that already exist everywhere else in this project:
--   * Admin writes (course/meeting CRUD, the attendance password, manual
--     attendance corrections) go through the service-role client from a
--     requireAdmin()-gated Server Action — no client-facing INSERT/
--     UPDATE/DELETE policy on any of these tables at all, exactly like
--     products/devotionals.
--   * The three actions a signed-in student genuinely owns (enroll,
--     cancel, record their own attendance) go through SECURITY DEFINER
--     RPCs bound to auth.uid(), called via the session client — exactly
--     like record_devotional_view()/mark_notification_read(). The
--     client never gets to assert whose enrollment or attendance a
--     write is for.

create extension if not exists pgcrypto;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  cover_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'archived')),
  enrollment_open boolean not null default true,
  attendance_enabled boolean not null default true,
  -- bcrypt hash via pgcrypto's crypt()/gen_salt('bf') — never the raw
  -- password, never readable by any client role (no SELECT exposes it;
  -- record_course_attendance() below is the only thing that ever reads
  -- it, as the function owner, and it never returns it).
  attendance_password_hash text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index courses_status_idx on public.courses(status);

alter table public.courses enable row level security;

-- published: open for enrollment/browsing. closed: finished but still
-- listed (so past participants can still see their own history and the
-- course stays in the public catalog as "cerrado", not vanish). draft
-- and archived are never shown to anyone but an admin.
create policy "Anyone can view published or closed courses"
  on public.courses
  for select
  to public
  using (status in ('published', 'closed'));
-- No insert/update/delete policy for any client role — admin writes only
-- ever happen through the service-role client behind requireAdmin().

create table public.course_meetings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  scheduled_at timestamptz,
  position integer not null default 0,
  attendance_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index course_meetings_course_id_idx on public.course_meetings(course_id, position);

alter table public.course_meetings enable row level security;

create policy "Anyone can view meetings of a visible course"
  on public.course_meetings
  for select
  to public
  using (exists (select 1 from public.courses c where c.id = course_id and c.status in ('published', 'closed')));

create table public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  enrolled_at timestamptz not null default now(),
  cancelled_at timestamptz,
  -- One row per (course, person) ever — re-enrolling after cancelling
  -- updates this same row (see enroll_in_course()) rather than creating
  -- a second one, so attendance history tied to it is never orphaned.
  unique (course_id, user_id)
);

create index course_enrollments_user_id_idx on public.course_enrollments(user_id);
create index course_enrollments_course_id_idx on public.course_enrollments(course_id);

alter table public.course_enrollments enable row level security;

create policy "Users view their own enrollments, admins view all"
  on public.course_enrollments
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin(auth.uid()));
-- No insert/update/delete policy — enroll_in_course()/cancel_enrollment()
-- below are the only way to write this table from a client.

create table public.course_attendance (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.course_meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  -- Set only when this row was written by an admin's manual correction
  -- (see admin-courses.ts) rather than the student's own
  -- record_course_attendance() call — null means "the student recorded
  -- this themselves".
  corrected_by uuid references auth.users(id),
  -- The real defense against double-counting: a second INSERT for the
  -- same (meeting, person) — whether from a double click, a page
  -- reload, or two concurrent requests — can only ever conflict here,
  -- never create a second row. Counts are always COUNT(*) over this
  -- table, never a separately-incremented column that could drift from
  -- it.
  unique (meeting_id, user_id)
);

create index course_attendance_user_id_idx on public.course_attendance(user_id);
create index course_attendance_meeting_id_idx on public.course_attendance(meeting_id);

alter table public.course_attendance enable row level security;

create policy "Users view their own attendance, admins view all"
  on public.course_attendance
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin(auth.uid()));
-- No insert/update/delete policy — record_course_attendance() below (for
-- the student themselves) and the admin/service-role client (for manual
-- corrections) are the only ways to write this table.

-- Pure rate-limit bookkeeping for wrong attendance-password attempts —
-- RLS enabled with zero policies for any role, so nothing but a
-- SECURITY DEFINER function (owned by the migration role, which bypasses
-- this table's own RLS) can ever read or write it. Never exposed to any
-- client, not even "my own" attempt count.
create table public.course_attendance_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  failed_count integer not null default 0,
  locked_until timestamptz,
  last_attempt_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

alter table public.course_attendance_attempts enable row level security;

insert into storage.buckets (id, name, public)
values ('course-covers', 'course-covers', true)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 5 * 1024 * 1024, -- 5 MB, same ceiling as book-covers
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'course-covers';

-- Covers are public catalog images; only admins ever upload/replace one,
-- enforced in the app layer (requireAdmin() + the admin/service-role
-- client), exactly like book-covers — see that bucket's own policy for
-- the full reasoning.
create policy "Anyone can view course covers"
  on storage.objects
  for select
  to public
  using (bucket_id = 'course-covers');

-- Enrolls the real calling user (never a client-supplied id) in a course
-- that's actually open for it right now. Idempotent and resumable: a
-- cancelled enrollment re-enrolling just flips the same row back to
-- active rather than erroring or creating a duplicate, so its attendance
-- history (tied to user_id + meeting_id, not to the enrollment row)
-- is never lost by cancelling and rejoining.
create or replace function public.enroll_in_course(p_course_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course record;
begin
  select status, enrollment_open into v_course from public.courses where id = p_course_id;

  if v_course is null or v_course.status <> 'published' or v_course.enrollment_open is not true then
    return 'not_available';
  end if;

  insert into public.course_enrollments (course_id, user_id, status, enrolled_at, cancelled_at)
  values (p_course_id, auth.uid(), 'active', now(), null)
  on conflict (course_id, user_id)
  do update set status = 'active', enrolled_at = now(), cancelled_at = null;

  return 'enrolled';
end;
$$;

revoke all on function public.enroll_in_course(uuid) from public;
grant execute on function public.enroll_in_course(uuid) to authenticated;

create or replace function public.cancel_enrollment(p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.course_enrollments
  set status = 'cancelled', cancelled_at = now()
  where course_id = p_course_id and user_id = auth.uid() and status = 'active';
end;
$$;

revoke all on function public.cancel_enrollment(uuid) from public;
grant execute on function public.cancel_enrollment(uuid) to authenticated;

-- The core of the attendance system. Returns a short status code (never
-- the password, never why in more detail than this) that the caller
-- (lib/actions/courses.ts) maps to an honest, specific, non-leaky
-- message:
--   'recorded'          — attendance newly recorded just now
--   'already_recorded'  — this exact (meeting, person) already had a row
--                          (idempotent: a double click/reload/concurrent
--                          resend never creates a second one, and still
--                          honestly tells the student they're already in)
--   'not_enrolled'       — no active enrollment in this meeting's course
--   'attendance_closed'  — course or meeting has attendance disabled, or
--                          no password has ever been configured
--   'wrong_password'     — password didn't match
--   'locked'             — too many recent wrong attempts
create or replace function public.record_course_attendance(p_meeting_id uuid, p_password text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting record;
  v_course record;
  v_enrolled boolean;
  v_attempts record;
  v_inserted uuid;
begin
  select id, course_id, attendance_enabled into v_meeting
  from public.course_meetings where id = p_meeting_id;

  if v_meeting is null then
    return 'attendance_closed';
  end if;

  select status, attendance_enabled, attendance_password_hash into v_course
  from public.courses where id = v_meeting.course_id;

  if v_course is null or v_course.attendance_enabled is not true or v_meeting.attendance_enabled is not true
     or v_course.attendance_password_hash is null then
    return 'attendance_closed';
  end if;

  select exists(
    select 1 from public.course_enrollments
    where course_id = v_meeting.course_id and user_id = auth.uid() and status = 'active'
  ) into v_enrolled;

  if not v_enrolled then
    return 'not_enrolled';
  end if;

  select failed_count, locked_until into v_attempts
  from public.course_attendance_attempts
  where user_id = auth.uid() and course_id = v_meeting.course_id;

  if v_attempts is not null and v_attempts.locked_until is not null and v_attempts.locked_until > now() then
    return 'locked';
  end if;

  if v_course.attendance_password_hash <> crypt(p_password, v_course.attendance_password_hash) then
    insert into public.course_attendance_attempts (user_id, course_id, failed_count, last_attempt_at, locked_until)
    values (auth.uid(), v_meeting.course_id, 1, now(), null)
    on conflict (user_id, course_id) do update set
      failed_count = public.course_attendance_attempts.failed_count + 1,
      last_attempt_at = now(),
      -- Locks for 15 minutes after the 5th wrong attempt in a row —
      -- reset to 0 below the moment the password is entered correctly.
      locked_until = case
        when public.course_attendance_attempts.failed_count + 1 >= 5 then now() + interval '15 minutes'
        else null
      end;
    return 'wrong_password';
  end if;

  delete from public.course_attendance_attempts
  where user_id = auth.uid() and course_id = v_meeting.course_id;

  insert into public.course_attendance (meeting_id, user_id, recorded_at)
  values (p_meeting_id, auth.uid(), now())
  on conflict (meeting_id, user_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    return 'already_recorded';
  end if;

  return 'recorded';
end;
$$;

revoke all on function public.record_course_attendance(uuid, text) from public;
grant execute on function public.record_course_attendance(uuid, text) to authenticated;

-- Admin-only: hashes and stores a course's attendance password. Called
-- via the service-role client from a requireAdmin()-gated Server
-- Action (lib/actions/admin-courses.ts) — the same trust boundary every
-- other admin write in this project already relies on — plus this
-- internal check as defense in depth, since unlike the two functions
-- above this one isn't naturally scoped to "the calling user's own
-- row" by auth.uid().
create or replace function public.set_course_attendance_password(p_course_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  update public.courses
  set attendance_password_hash = crypt(p_password, gen_salt('bf')), updated_at = now()
  where id = p_course_id;
end;
$$;

revoke all on function public.set_course_attendance_password(uuid, text) from public;
-- Granted to authenticated too (not just relying on the service-role
-- key's RLS bypass) so the internal is_admin() check above is a real,
-- load-bearing guard — matching protect_profile_privileges()'s same
-- "service_role is already a trusted context either way" reasoning.
grant execute on function public.set_course_attendance_password(uuid, text) to authenticated;
