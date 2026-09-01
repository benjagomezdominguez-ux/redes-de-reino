import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Admin-only read of connection *status* — deliberately never selects
// access_token here. This is the only place outside
// src/lib/tiendanube/client.ts that touches tiendanube_connections, and
// it only ever needs to know whether a store is connected, not the
// token itself.
export type TiendanubeConnectionStatus = {
  connected: boolean;
  storeId: string | null;
  connectedAt: string | null;
};

export async function getTiendanubeConnectionStatus(): Promise<TiendanubeConnectionStatus> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("tiendanube_connections")
    .select("store_id, connected_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    connected: Boolean(data),
    storeId: data?.store_id ?? null,
    connectedAt: data?.connected_at ?? null,
  };
}
