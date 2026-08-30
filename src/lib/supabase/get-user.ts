import "server-only";
import { getSupabaseSessionClient } from "@/lib/supabase/session";

export async function getAuthUser() {
  const supabase = await getSupabaseSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}
