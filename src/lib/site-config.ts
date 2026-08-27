// Contenido central del sitio. Los valores marcados como "pendiente" son
// placeholders intencionales: no se inventa información oficial de la
// iglesia (dirección, horarios, redes, datos bancarios, biografías).

export const PENDING = "[CONTENIDO PENDIENTE]";

export const site = {
  name: "Redes de Reino",
  location: "Salta, Argentina",
  tagline: "Fe, comunidad y propósito",
  description:
    "Una comunidad de fe, crecimiento y propósito en Salta, Argentina.",
};

export const navLinks = [
  { href: "#inicio", label: "Inicio" },
  { href: "#nuestra-iglesia", label: "Nuestra Iglesia" },
  { href: "#pastores", label: "Pastores" },
  { href: "#membresia", label: "Membresía" },
  { href: "#estudios-biblicos", label: "Estudios Bíblicos" },
  { href: "#diezmos-y-ofrendas", label: "Diezmos y Ofrendas" },
  { href: "#contacto", label: "Contacto" },
];

export const pastors = [
  {
    name: "Ariel Gómez",
    role: "Pastor",
    photo: null as string | null,
  },
  {
    name: "Gabriela de Gómez",
    role: "Pastora",
    photo: null as string | null,
  },
];

export type BibleStudy = {
  title: string;
  description: string;
  teacher: string;
  day: string;
  time: string;
  status: "Inscripciones abiertas" | "Próximamente" | "En curso";
};

// Contenido provisional — reemplazar por los estudios reales de la iglesia.
export const bibleStudies: BibleStudy[] = [
  {
    title: PENDING,
    description: "Este espacio mostrará el detalle del estudio bíblico.",
    teacher: PENDING,
    day: PENDING,
    time: PENDING,
    status: "Próximamente",
  },
  {
    title: PENDING,
    description: "Este espacio mostrará el detalle del estudio bíblico.",
    teacher: PENDING,
    day: PENDING,
    time: PENDING,
    status: "Próximamente",
  },
  {
    title: PENDING,
    description: "Este espacio mostrará el detalle del estudio bíblico.",
    teacher: PENDING,
    day: PENDING,
    time: PENDING,
    status: "Próximamente",
  },
];

export type Activity = {
  title: string;
  description: string;
  group: string;
};

// Contenido provisional — reemplazar por las actividades reales de la iglesia.
export const activities: Activity[] = [
  {
    title: PENDING,
    description: "Encuentros y reuniones generales de la congregación.",
    group: "Reuniones",
  },
  {
    title: PENDING,
    description: "Espacio de crecimiento y comunión para jóvenes.",
    group: "Jóvenes",
  },
  {
    title: PENDING,
    description: "Actividades pensadas para familias.",
    group: "Familias",
  },
  {
    title: PENDING,
    description: "Grupos pequeños de estudio y oración.",
    group: "Grupos",
  },
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
