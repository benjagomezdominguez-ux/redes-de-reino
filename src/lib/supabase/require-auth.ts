import "server-only";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getAuthProfile, type AuthProfile } from "./get-profile";

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
