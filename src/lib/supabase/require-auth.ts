import "server-only";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getAuthProfile, type AuthProfile } from "./get-profile";
import { isChatAdmin } from "@/lib/chat/is-chat-admin";

// Server-side route guards. These are the actual security boundary (rule
// 2) — middleware.ts also redirects unauthenticated visitors away from
// protected paths, but only as a fast, cookie-only UX nicety that also
// carries a `next` redirect-back param. This is the backstop that always
// runs, with no way for a client to bypass it: every (protected)/admin
// layout calls one of these before rendering anything.

export async function requireUser(): Promise<AuthProfile> {
  const profile = await getAuthProfile();
  if (!profile || profile.status !== "active") {
    const locale = await getLocale();
    redirect({ href: "/login", locale });
  }
  // redirect() throws (it never actually returns) — this cast just tells
  // TS what every caller already relies on being true past this point.
  return profile as AuthProfile;
}

export async function requireAdmin(): Promise<AuthProfile> {
  const profile = await getAuthProfile();
  const locale = await getLocale();

  if (!profile || profile.status !== "active") {
    redirect({ href: "/login", locale });
  }
  if ((profile as AuthProfile).role !== "admin") {
    redirect({ href: "/403", locale });
  }
  return profile as AuthProfile;
}

// The chat's admin side is private to Ariel Gómez specifically — other
// admins (e.g. the site's original admin/owner account) are refused the
// same as any non-admin, per explicit request. See
// src/lib/chat/is-chat-admin.ts.
export async function requireChatAdmin(): Promise<AuthProfile> {
  const profile = await getAuthProfile();
  const locale = await getLocale();

  if (!profile || profile.status !== "active") {
    redirect({ href: "/login", locale });
  }
  if (!isChatAdmin(profile as AuthProfile)) {
    redirect({ href: "/403", locale });
  }
  return profile as AuthProfile;
}
