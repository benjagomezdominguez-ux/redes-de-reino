-- Admin-managed carousel photos, replacing the hardcoded 4-slot
-- placeholder array in site-config.ts (galleryImages). Mirrors the exact
-- pattern already established for book covers: a public bucket with
-- signed upload URLs minted by requireAdmin()-gated Server Actions, and
-- writes only ever going through the service-role client — see
-- 20260828000100_create_book_files_bucket.sql /
-- 20260831120000_add_payments_tax_and_transfers.sql.
create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  title text,
  alt_text text,
  object_position text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index gallery_images_sort_order_idx on public.gallery_images(sort_order);

alter table public.gallery_images enable row level security;

-- Public, read-only — the public carousel and the admin list read
-- through this same policy. There's no separate "draft" concept here:
-- every row is a live carousel slide. No insert/update/delete policy
-- exists for any client role — all writes go through the service-role
-- client inside requireAdmin()-gated Server Actions, same as `products`.
create policy "Anyone can view gallery images"
  on public.gallery_images
  for select
  to public
  using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery-photos', 'gallery-photos', true, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Public, viewable images (carousel photos), but only admins upload/
-- replace/delete them — enforced in the app layer (requireAdmin() + the
-- admin/service-role client), not via a storage RLS policy, exactly like
-- book-covers. Only a public SELECT policy is needed here.
create policy "Anyone can view gallery photos"
  on storage.objects
  for select
  to public
  using (bucket_id = 'gallery-photos');
