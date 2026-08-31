// ISO 3166-1 alpha-2 codes — standard reference data, not invented
// commercial content. Used both for the billing-country selector and as
// the key the server-side tax engine (tax_rules.country_code) matches
// against.
export const countries = [
  { code: "AR", name: "Argentina" },
  { code: "BO", name: "Bolivia" },
  { code: "BR", name: "Brasil" },
  { code: "CA", name: "Canadá" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "CR", name: "Costa Rica" },
  { code: "CU", name: "Cuba" },
  { code: "DO", name: "República Dominicana" },
  { code: "EC", name: "Ecuador" },
  { code: "ES", name: "España" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "MX", name: "México" },
  { code: "NI", name: "Nicaragua" },
  { code: "PA", name: "Panamá" },
  { code: "PE", name: "Perú" },
  { code: "PR", name: "Puerto Rico" },
  { code: "PY", name: "Paraguay" },
  { code: "SV", name: "El Salvador" },
  { code: "UY", name: "Uruguay" },
  { code: "US", name: "Estados Unidos" },
  { code: "VE", name: "Venezuela" },
] as const;
