"use server";

import { z } from "zod";
import { getSupabaseSessionClient } from "@/lib/supabase/session";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { safeRedirectPath } from "@/lib/security/safe-redirect";
import { getRequestOrigin } from "@/lib/security/request-origin";

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
});

const signupSchema = credentialsSchema.extend({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  confirmPassword: z.string().min(6),
});

export type AuthFormState = {
  status: "idle" | "error" | "checkEmail";
  errorKey?:
    | "invalidCredentials"
    | "emailInUse"
    | "passwordMismatch"
    | "required"
    | "accountDisabled"
    | "rateLimited"
    | "confirmationNotSent"
    | "generic";
  // Only set when status === "checkEmail" — the address a resend should
  // target. The server is the source of truth for this (the value it
  // just successfully signed up), not whatever the client's form input
  // currently holds, which could have been edited after submit.
  email?: string;
};

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", errorKey: "generic" };
  }

  const supabase = await getSupabaseSessionClient();
  const { error, data } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { status: "error", errorKey: "invalidCredentials" };
  }

  // Deactivated accounts (rule 8 of the admin-deactivation prompt: "no
  // debe poder iniciar una nueva sesión funcional") never get a working
  // session from here, even though the password was correct — sign the
  // just-created session back out immediately rather than leaving the
  // user with a cookie that every subsequent protected check would
  // reject anyway.
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.status === "inactive") {
    await supabase.auth.signOut();
    return { status: "error", errorKey: "accountDisabled" };
  }

  const locale = await getLocale();
  const next = safeRedirectPath(formData.get("next")?.toString());
  return redirect({ href: next ?? "/", locale });
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { status: "error", errorKey: "required" };
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { status: "error", errorKey: "passwordMismatch" };
  }

  const locale = await getLocale();
  const origin = await getRequestOrigin();
  const supabase = await getSupabaseSessionClient();
  const { error, data } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { first_name: parsed.data.firstName, last_name: parsed.data.lastName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(`/${locale}`)}`,
    },
  });

  if (error) {
    // Supabase's own email-sending rate limit (its default SMTP is
    // heavily throttled) — surfaced as "email rate limit exceeded" /
    // status 429. Distinguishing it matters: it looks and feels
    // identical to a random glitch ("Algo salió mal. Probá de nuevo.")
    // otherwise, when it's actually a known, temporary, non-retriable-
    // right-now condition the user should just wait out.
    const message = error.message.toLowerCase();
    const errorKey = message.includes("already")
      ? "emailInUse"
      : message.includes("rate limit") || error.status === 429
        ? "rateLimited"
        : "generic";
    return { status: "error", errorKey };
  }

  // This project requires email confirmation (Supabase default), so
  // signUp never returns an active session — the user has to click the
  // link in their inbox before signInWithPassword will work.
  if (!data.session) {
    // error === null only means Supabase's API accepted the request —
    // it is NOT proof the confirmation email actually got dispatched.
    // GoTrue (Supabase Auth) calls its mailer inline, before responding,
    // and sets user.confirmation_sent_at at that same moment — every
    // real failure this project has reproduced (including a rate-limit
    // hit live against production) came back as a real `error` instead,
    // never as a silent error:null with this field left empty. But that
    // correlation, observed across a finite number of real tests, isn't
    // a guarantee, and showing "revisá tu correo" is exactly the one
    // place a wrong guess here would be invisible to the user until
    // they give up waiting on an email that was never actually queued.
    // Trust the one additional, independent signal Supabase itself
    // provides rather than `error === null` alone.
    if (!data.user?.confirmation_sent_at) {
      console.error("signUp() succeeded but confirmation_sent_at is empty — email may not have been dispatched", {
        userId: data.user?.id,
      });
      return { status: "error", errorKey: "confirmationNotSent" };
    }
    return { status: "checkEmail", email: parsed.data.email };
  }

  const next = safeRedirectPath(formData.get("next")?.toString());
  return redirect({ href: next ?? "/", locale });
}

export async function signOut() {
  const supabase = await getSupabaseSessionClient();
  await supabase.auth.signOut();
  const locale = await getLocale();
  redirect({ href: "/", locale });
}

const emailSchema = z.object({ email: z.string().trim().email() });

export type ForgotPasswordState = {
  status: "idle" | "success" | "error";
  errorKey?: "generic";
};

// Always returns the same "success" state regardless of whether the email
// exists or the Supabase call errored — rule 6: never let this endpoint
// be used to enumerate registered emails. A malformed email is the only
// thing that produces a different (validation) response.
export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", errorKey: "generic" };
  }

  const locale = await getLocale();
  const origin = await getRequestOrigin();
  const supabase = await getSupabaseSessionClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(`/${locale}/reset-password`)}`,
  });

  return { status: "success" };
}

export type ResendConfirmationState = {
  status: "idle" | "success" | "error";
  errorKey?: "rateLimited" | "generic";
};

// Lets someone stuck on the post-signup "revisá tu correo" screen ask
// Supabase to send that confirmation email again — the project had no
// recovery path at all for a mis-sent, delayed, or spam-filtered first
// email before this. Same emailRedirectTo construction as signUp()
// itself (real request origin, not a hardcoded one), so a resent link
// lands exactly where the original one would have.
//
// Unlike requestPasswordReset(), this doesn't need to mask "does this
// email exist" — the only caller that can reach it already knows the
// address exists and is mid-signup (it's the exact value signUp() just
// echoed back in AuthFormState.email, not an arbitrary address a visitor
// typed in). Supabase's own real-world rate limit (its default mailer
// is heavily throttled — see auth.ts's signUp() comment) is the actual
// constraint here, surfaced the same way signUp() already surfaces it.
export async function resendConfirmationEmail(
  _prevState: ResendConfirmationState,
  formData: FormData
): Promise<ResendConfirmationState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", errorKey: "generic" };
  }

  const locale = await getLocale();
  const origin = await getRequestOrigin();
  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(`/${locale}`)}`,
    },
  });

  if (error) {
    const message = error.message.toLowerCase();
    const errorKey = message.includes("rate limit") || error.status === 429 ? "rateLimited" : "generic";
    return { status: "error", errorKey };
  }

  return { status: "success" };
}

const newPasswordSchema = z
  .object({
    password: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
  });

export type ResetPasswordState = {
  status: "idle" | "success" | "error";
  errorKey?: "passwordMismatch" | "generic";
};

// Only works if the caller already holds the short-lived recovery session
// that /auth/callback establishes after the emailed link's code exchange
// — there is no other way to reach this successfully.
export async function updatePassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((i) => i.path[0] === "confirmPassword");
    return { status: "error", errorKey: mismatch ? "passwordMismatch" : "generic" };
  }

  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { status: "error", errorKey: "generic" };
  }

  return { status: "success" };
}
