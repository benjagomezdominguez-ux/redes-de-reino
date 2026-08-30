-- Private bucket for digital book files. `public = false` means nothing
-- is servable by a plain URL — the only way to read an object is a
-- signed URL, and only src/lib/books/digital-access.ts (using the secret
-- key) is ever allowed to mint one. No storage.objects policies are
-- created for anon/authenticated, so RLS denies them entirely.
insert into storage.buckets (id, name, public)
values ('book-files', 'book-files', false)
on conflict (id) do nothing;
