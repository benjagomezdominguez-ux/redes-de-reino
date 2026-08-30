import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Product } from "./types";

export async function getActiveProducts(): Promise<Product[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getActiveProducts failed", error);
    return [];
  }

  return data ?? [];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("getProductBySlug failed", error);
    return null;
  }

  return data;
}
