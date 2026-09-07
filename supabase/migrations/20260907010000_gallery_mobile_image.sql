-- Adds an optional mobile-specific variant to the (still singleton)
-- "Galería" photo — the public full-bleed image right after the Hero
-- (Gallery.tsx / GalleryAdminPanel.tsx). storage_path keeps meaning
-- exactly what it always meant (the desktop/16:9 image) — existing rows
-- and their data are untouched. mobile_storage_path is nullable so the
-- public section falls back to the desktop image until an admin
-- uploads a dedicated mobile (9:16) one.
alter table public.gallery_images
  add column mobile_storage_path text;
