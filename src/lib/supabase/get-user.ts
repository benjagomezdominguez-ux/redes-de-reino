import "server-only";
import { getAuthProfile } from "./get-profile";
import { isChatAdmin } from "@/lib/chat/is-chat-admin";

// Thin wrapper kept for callers (the Navbar) that only need identity +
// role, not the full profile shape. isChatAdmin is exposed as a plain
// boolean — safe to send to the client — rather than firstName/lastName,
// which the Navbar has no other reason to receive.
export async function getAuthUser() {
  const profile = await getAuthProfile();
  if (!profile) return null;
  return { id: profile.id, email: profile.email, role: profile.role, isChatAdmin: isChatAdmin(profile) };
}
