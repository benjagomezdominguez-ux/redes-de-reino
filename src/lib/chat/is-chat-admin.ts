import type { AuthProfile } from "@/lib/supabase/get-profile";

// The chat is private to Ariel Gómez specifically — explicitly requested
// to hold even against other admin accounts (e.g. the site's original
// admin/owner, who is also role: 'admin'). Matched by name against the
// real profiles data, same "find this one real person" pattern as
// findBenjaminGomezEmail() in the WhatsApp system — never a hardcoded
// UUID. Mirrored exactly by is_chat_admin() in the
// 20260902020000 migration, which is what actually enforces this at the
// database/RLS level — this TS copy is only the fast-path gate for
// pages/Server Actions; keep both in sync if this ever changes.
export function isChatAdmin(
  profile: Pick<AuthProfile, "role" | "status" | "firstName" | "lastName"> | null | undefined
): boolean {
  if (!profile) return false;
  return (
    profile.role === "admin" &&
    profile.status === "active" &&
    (profile.firstName ?? "").toLowerCase().startsWith("ariel") &&
    (profile.lastName ?? "").toLowerCase().includes("gomez")
  );
}
