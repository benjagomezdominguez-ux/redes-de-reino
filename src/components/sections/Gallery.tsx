import Image from "next/image";
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

  return (
    <section id="galeria" className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="relative h-[70vh] max-h-[820px] min-h-[420px] w-full overflow-hidden rounded-2xl bg-primary-900 shadow-lifted">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt_text || t("imageAlt", { name: site.name })}
            fill
            sizes="100vw"
            priority
            className="object-cover"
            style={{ objectPosition: image.object_position ?? "center" }}
          />
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
