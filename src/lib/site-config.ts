// Structural/official data only. Everything user-facing and translatable
// lives in messages/{es,en,pt}.json — see the corresponding *Key fields
// below, which components resolve via next-intl's t().

// Update this the day a custom domain replaces the Vercel subdomain —
// it's the single source of truth for absolute URLs (metadata, OG image,
// sitemap, structured data).
export const siteUrl = "https://redes-de-reino.vercel.app";

export const site = {
  name: "Redes de Reino",
  location: "Salta, Argentina",
};

export const navLinks = [
  { href: "#inicio", key: "inicio" },
  { href: "#galeria", key: "galeria" },
  { href: "#horarios", key: "horarios" },
  { href: "#pastores", key: "pastores" },
  { href: "#libros", key: "libros" },
] as const;

export const pastors = [
  {
    name: "Ariel Gómez",
    roleKey: "pastor",
    photo: "/pastor-ariel.jpg" as string | null,
  },
  {
    name: "Gabriela de Gómez",
    roleKey: "pastora",
    photo: "/pastora-gabriela.jpg" as string | null,
  },
] as const;

export type GalleryImage = {
  // Real photo, pending from the church. Drop a path (e.g. "/gallery-1.jpg")
  // in here to replace the placeholder — no component changes needed.
  src: string | null;
  // CSS object-position, per image, for when the subject sits off-center.
  objectPosition?: string;
};

// Exactly 4 slides for the cinematic gallery — see CinematicGallery.
export const galleryImages: GalleryImage[] = [
  { src: null },
  { src: null },
  { src: null },
  { src: null },
];

export type WeekdayKey =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";

export type Meeting = {
  // Which weekday this meets on — translated via messages.schedule.days.
  // Pending until the church confirms real meeting days.
  dayKey: WeekdayKey | null;
  // Real meeting name (e.g. "Reunión General") — not translated, since
  // it's official content, not UI chrome.
  title: string | null;
  // Display string as-is (e.g. "19:00 hs") — pending real data.
  time: string | null;
  description: string | null;
};

// Order here is display order, as requested by the church.
export const meetings: Meeting[] = [
  { dayKey: "domingo", title: "Reunión General", time: "10:00 AM", description: null },
  { dayKey: "sabado", title: "Bases", time: "19:00 PM", description: null },
  { dayKey: "miercoles", title: "Trascender", time: "20:00 PM", description: null },
];

