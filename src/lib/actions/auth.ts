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
    | "generic";
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
    const errorKey = error.message.toLowerCase().includes("already")
      ? "emailInUse"
      : "generic";
    return { status: "error", errorKey };
  }

  // This project requires email confirmation (Supabase default), so
  // signUp never returns an active session — the user has to click the
  // link in their inbox before signInWithPassword will work.
  if (!data.session) {
    return { status: "checkEmail" };
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
