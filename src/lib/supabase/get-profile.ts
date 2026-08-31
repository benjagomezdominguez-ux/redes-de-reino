import "server-only";
import { getSupabaseSessionClient } from "./session";

export type AuthRole = "user" | "admin";
export type AuthStatus = "active" | "inactive";

export type AuthProfile = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: AuthRole;
  status: AuthStatus;
};

// The single source of truth for "who is this and what can they do" on
// the server. Role/status always come from the profiles row (protected by
// RLS + a trigger — see the migration), never from anything the client
// could have sent.
export async function getAuthProfile(): Promise<AuthProfile | null> {
  const supabase = await getSupabaseSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, role, status")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    role: (profile?.role as AuthRole | undefined) ?? "user",
    status: (profile?.status as AuthStatus | undefined) ?? "active",
  };
}
