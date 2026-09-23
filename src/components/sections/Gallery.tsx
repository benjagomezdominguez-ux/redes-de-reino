import { getTranslations } from "next-intl/server";
import { getGalleryImages } from "@/lib/gallery/queries";
import { site } from "@/lib/site-config";

// The Gallery is a single photo, not a carousel (Fase 12) — at most one
// row ever exists in gallery_images (enforced by the
// gallery_images_singleton unique index), so this always renders exactly
// one image, or the "coming soon" placeholder while none has been
// uploaded yet.
//
// One photo, any aspect ratio (Fase 17) — no forced crop, no separate
// mobile/desktop variant. The image keeps its own intrinsic ratio: it
// scales to the available width, its height follows automatically
// (max-width/max-height + width/height:auto, not a fixed box), and the
// wrapper shrink-wraps to whatever size that ends up being (w-fit) so a
// narrow portrait photo doesn't sit inside a giant box with empty bars
// on the sides. Never object-fit: cover here — that crops whatever
// doesn't match a fixed box, which is exactly the "forces 16:9" behavior
// this replaces.
export async function Gallery() {
  const t = await getTranslations("gallery");
  const [image] = await getGalleryImages();
  const alt = image?.alt_text || t("imageAlt", { name: site.name });

  return (
    <section id="galeria" className="flex justify-center px-4 py-6 sm:px-6 sm:py-8">
      {image ? (
        <div className="group w-fit max-w-full overflow-hidden rounded-2xl bg-primary-900 shadow-lifted transition-shadow duration-300 hover:shadow-[0_4px_10px_rgb(28_31_43_/_0.06),_0_28px_56px_rgb(28_31_43_/_0.16)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- intrinsic sizing (no fixed box, no object-fit crop) needs the image's real dimensions, which next/image's fill mode doesn't expose */}
          <img
            src={image.url}
            alt={alt}
            className="block h-auto max-h-[75vh] w-auto max-w-full rounded-2xl transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        </div>
      ) : (
        <div className="flex h-[420px] w-full items-center justify-center rounded-2xl bg-primary-900 bg-[radial-gradient(circle_at_30%_20%,_var(--color-primary-700)_0%,_transparent_55%)]">
          <span className="text-sm font-medium uppercase tracking-[0.18em] text-white/50">
            {t("pending")}
          </span>
        </div>
      )}
    </section>
  );
}
