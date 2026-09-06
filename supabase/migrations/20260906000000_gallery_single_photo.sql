-- Gallery is now a single photo, not a carousel (Fase 12 of the "modificación
-- integral" prompt). Rather than reshape gallery_images into a one-off
-- singleton table, keep the existing one-row-per-photo shape (still the
-- right model if this ever needs more than one photo again) and enforce
-- "at most one row" at the database level with a unique index on a
-- constant expression — defense in depth alongside the application-layer
-- check added to createGalleryImage() (src/lib/actions/admin-gallery.ts),
-- consistent with how this project already enforces invariants at both
-- layers (e.g. digital_entitlements' unique constraint).
create unique index if not exists gallery_images_singleton
  on public.gallery_images ((true));
