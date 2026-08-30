"use server";

import { z } from "zod";
import { getSupabaseSessionClient } from "@/lib/supabase/session";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
});

export type AuthFormState = {
  status: "idle" | "error" | "checkEmail";
  errorKey?: "invalidCredentials" | "emailInUse" | "generic";
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
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { status: "error", errorKey: "invalidCredentials" };
  }

  const locale = await getLocale();
  // "Libros" is a section of the home page (#libros), not its own route.
  return redirect({ href: "/", locale });
}

export async function signUp(
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
  const { error, data } = await supabase.auth.signUp(parsed.data);

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

  const locale = await getLocale();
  return redirect({ href: "/", locale });
}

export async function signOut() {
  const supabase = await getSupabaseSessionClient();
  await supabase.auth.signOut();
  const locale = await getLocale();
  redirect({ href: "/", locale });
}
