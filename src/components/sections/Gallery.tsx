import { CinematicGallery, type GalleryImage } from "@/components/ui/CinematicGallery";
import { getGalleryImages } from "@/lib/gallery/queries";

// A single unconfigured slot (the same "coming soon" placeholder the
// carousel already showed before any photo existed) so the section
// never looks broken while an admin hasn't added photos yet.
const EMPTY_PLACEHOLDER: GalleryImage[] = [{ src: null }];

export async function Gallery() {
  const rows = await getGalleryImages();
  const images: GalleryImage[] =
    rows.length > 0
      ? rows.map((row) => ({ src: row.url, alt: row.alt_text, objectPosition: row.object_position }))
      : EMPTY_PLACEHOLDER;

  return (
    <section id="galeria" className="px-4 py-6 sm:px-6 sm:py-8">
      <CinematicGallery images={images} />
    </section>
  );
}
