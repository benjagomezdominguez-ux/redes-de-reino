import type { AuthProfile } from "@/lib/supabase/get-profile";

// Strips the Spanish accented vowels/ñ that could otherwise legitimately
// appear in a real stored name ("Gómez") and silently break a plain
// ilike/.includes() match against the unaccented "gomez" — the exact
// mirror of fold_es_accents() in the 20260906020000 migration, which
// is_chat_admin() (SQL, the real RLS enforcement) and get_chat_admin_id()
// both use. Keep these in sync.
function foldEsAccents(value: string): string {
  return value
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n");
}

// The chat is private to Ariel Gómez specifically — explicitly requested
// to hold even against other admin accounts (e.g. the site's original
// admin/owner, who is also role: 'admin'). Matched by name against the
// real profiles data, same "find this one real person" pattern as
// findBenjaminGomezEmail() in the WhatsApp system — never a hardcoded
// UUID. Mirrored exactly by is_chat_admin() in the
// 20260902020000/20260906020000 migrations, which is what actually
// enforces this at the database/RLS level — this TS copy is only the
// fast-path gate for pages/Server Actions; keep both in sync if this
// ever changes.
export function isChatAdmin(
  profile: Pick<AuthProfile, "role" | "status" | "firstName" | "lastName"> | null | undefined
): boolean {
  if (!profile) return false;
  const firstName = foldEsAccents((profile.firstName ?? "").toLowerCase());
  const lastName = foldEsAccents((profile.lastName ?? "").toLowerCase());
  return (
    profile.role === "admin" &&
    profile.status === "active" &&
    firstName.startsWith("ariel") &&
    lastName.includes("gomez")
  );
}
