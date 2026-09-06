-- get_chat_admin_id() (added in 20260906020000) turned out to add a real,
-- measurable request-latency cost (a first-call PostgREST schema-cache
-- reload, confirmed live: ~4s cold, ~2s warm, vs. near-instant for a
-- plain table query) for no benefit over just reusing isChatAdmin() (TS)
-- directly against a small, already-cheap admin-accounts query — which
-- src/lib/chat/chat-admin-lookup.ts now does instead. Dropping the unused
-- function rather than leaving dead code behind. fold_es_accents() and
-- is_chat_admin() (both still used by RLS) are untouched.
drop function if exists public.get_chat_admin_id();
