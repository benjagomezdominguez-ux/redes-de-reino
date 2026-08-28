import { CinematicGallery } from "@/components/ui/CinematicGallery";
import { galleryImages } from "@/lib/site-config";

export function Gallery() {
  return (
    <section id="galeria" className="px-4 py-6 sm:px-6 sm:py-8">
      <CinematicGallery images={galleryImages} />
    </section>
  );
}
