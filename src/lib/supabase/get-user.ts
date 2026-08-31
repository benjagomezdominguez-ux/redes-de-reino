import "server-only";
import { getAuthProfile } from "./get-profile";

// Thin wrapper kept for callers (the Navbar) that only need identity +
// role, not the full profile shape.
export async function getAuthUser() {
  const profile = await getAuthProfile();
  if (!profile) return null;
  return { id: profile.id, email: profile.email, role: profile.role };
}
