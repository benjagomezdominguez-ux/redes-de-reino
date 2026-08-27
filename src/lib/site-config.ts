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
  { href: "#nuestra-iglesia", key: "nuestraIglesia" },
  { href: "#pastores", key: "pastores" },
  { href: "#membresia", key: "membresia" },
  { href: "#estudios-biblicos", key: "estudiosBiblicos" },
  { href: "#diezmos-y-ofrendas", key: "diezmosYOfrendas" },
  { href: "#contacto", key: "contacto" },
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

export type BibleStudyStatusKey = "proximamente" | "enCurso" | "inscripcionesAbiertas";

export type BibleStudy = {
  // Real program name, not translated — see rule 11.
  title: string;
  teacher: string | null;
  day: string | null;
  time: string | null;
  statusKey: BibleStudyStatusKey;
};

// The rest of each card (teacher/day/time) is still pending real data
// from the church.
export const bibleStudies: BibleStudy[] = [
  { title: "Columnas", teacher: null, day: null, time: null, statusKey: "proximamente" },
  { title: "Bases", teacher: null, day: null, time: null, statusKey: "proximamente" },
  { title: "Protocolo", teacher: null, day: null, time: null, statusKey: "proximamente" },
];

export type ActivityGroupKey = "reuniones" | "jovenes" | "familias" | "grupos";

export type Activity = {
  // Real activity name — pending from the church.
  title: string | null;
  groupKey: ActivityGroupKey;
};

export const activities: Activity[] = [
  { title: null, groupKey: "reuniones" },
  { title: null, groupKey: "jovenes" },
  { title: null, groupKey: "familias" },
  { title: null, groupKey: "grupos" },
];

export const contact = {
  whatsapp: null as string | null,
  instagram: null as string | null,
  facebook: null as string | null,
  youtube: null as string | null,
  email: null as string | null,
  address: null as string | null,
  schedule: null as string | null,
};

export const giving = {
  alias: null as string | null,
  cbu: null as string | null,
  bank: null as string | null,
};
