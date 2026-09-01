import "server-only";
import { getAuthProfile } from "./get-profile";

// Same authorization semantics as requireAdmin() (require-auth.ts), but
// returns null instead of calling next-intl's redirect() — that helper
// is built for Server Components/Server Actions; a Route Handler needs
// to control its own HTTP response (redirect target, status code, JSON
// body) directly instead. Reuses getAuthProfile() rather than
// re-querying profiles directly, so there's exactly one place role/status
// are ever read from.
export async function getAdminUserOrNull(): Promise<{ id: string } | null> {
  const profile = await getAuthProfile();
  if (!profile || profile.role !== "admin" || profile.status !== "active") return null;
  return { id: profile.id };
}
