import { getTranslations } from "next-intl/server";
import { getGalleryImages } from "@/lib/gallery/queries";
import { site } from "@/lib/site-config";

// The Gallery is a single photo, not a carousel (Fase 12) — at most one
// row ever exists in gallery_images (enforced by the
// gallery_images_singleton unique index), so this always renders exactly
// one image, or the "coming soon" placeholder while none has been
// uploaded yet.
export async function Gallery() {
  const t = await getTranslations("gallery");
  const [image] = await getGalleryImages();
  const alt = image?.alt_text || t("imageAlt", { name: site.name });

  return (
    <section id="galeria" className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="relative h-[70vh] max-h-[820px] min-h-[420px] w-full overflow-hidden rounded-2xl bg-primary-900 shadow-lifted">
        {image ? (
          // A raw <picture> — not next/image — is what makes the device
          // switch actually save bandwidth: the browser picks a <source>
          // before fetching anything, so a phone never downloads the
          // desktop photo (or vice versa). next/image has no equivalent
          // for this "different photo per breakpoint" art-direction case,
          // only for serving different *sizes* of the *same* photo. Falls
          // back to the desktop image on mobile when no mobile-specific
          // one has been uploaded yet, so the section is never empty.
          <picture className="contents">
            {image.mobileUrl ? <source media="(max-width: 767px)" srcSet={image.mobileUrl} /> : null}
            <img
              src={image.url}
              alt={alt}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: image.object_position ?? "center" }}
            />
          </picture>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,_var(--color-primary-700)_0%,_transparent_55%)]">
            <span className="text-sm font-medium uppercase tracking-[0.18em] text-white/50">
              {t("pending")}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
