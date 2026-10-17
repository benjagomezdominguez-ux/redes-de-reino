-- Fix for a real error caught by live testing right after the previous
-- migration: `create extension if not exists pgcrypto` (no schema
-- given) installed it into Supabase's own `extensions` schema, as this
-- project's instance is configured to do by default — but
-- record_course_attendance()/set_course_attendance_password() both
-- declared `set search_path = public`, so crypt()/gen_salt() were never
-- actually reachable from inside them ("function gen_salt(unknown) does
-- not exist", reproduced live before this fix). Re-declaring both
-- functions with `extensions` added to their search_path is sufficient
-- — the extension itself doesn't need to move.
alter function public.record_course_attendance(uuid, text) set search_path = public, extensions;
alter function public.set_course_attendance_password(uuid, text) set search_path = public, extensions;
