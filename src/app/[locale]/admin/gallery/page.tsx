import { setRequestLocale } from "next-intl/server";
import { getGalleryImages } from "@/lib/gallery/queries";
import { GalleryAdminPanel } from "@/components/ui/GalleryAdminPanel";

export default async function AdminGalleryPage({
  params,
}: PageProps<"/[locale]/admin/gallery">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const images = await getGalleryImages();

  return <GalleryAdminPanel images={images} />;
}
