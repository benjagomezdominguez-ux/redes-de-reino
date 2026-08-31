-- Book covers/files and payment proofs are now uploaded directly from the
-- browser straight to Storage (via short-lived signed upload URLs minted
-- by admin-gated Server Actions), bypassing Next.js's Server Action body
-- entirely — that's what fixes real book files being capped at ~1MB by
-- Next's default Server Action body limit (and Vercel's own ~4.5MB hard
-- ceiling on serverless function bodies, which no Next.js config can
-- raise). Since the file bytes never touch our server anymore, size/MIME
-- validation has to live here instead, enforced by Supabase Storage
-- itself for every upload regardless of how it was requested.
update storage.buckets
set file_size_limit = 5 * 1024 * 1024, -- 5 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'book-covers';

update storage.buckets
set file_size_limit = 200 * 1024 * 1024 -- 200 MB, room for a real scanned/illustrated book
where id = 'book-files';

update storage.buckets
set file_size_limit = 10 * 1024 * 1024, -- 10 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'payment-proofs';
