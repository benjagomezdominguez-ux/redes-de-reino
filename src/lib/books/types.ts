export type ProductType = "digital" | "fisico" | "digital_fisico";

export type Product = {
  id: string;
  slug: string;
  title: string | null;
  author: string | null;
  description: string | null;
  cover_url: string | null;
  category: string | null;
  language: string;
  product_type: ProductType;
  digital_price_cents: number | null;
  physical_price_cents: number | null;
  currency: string;
  stock: number | null;
  status: "draft" | "active" | "inactive";
  sort_order: number;
};
