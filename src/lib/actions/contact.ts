"use server";

import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  interest: z.enum(["membresia", "contacto_general"]),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ContactErrorKey =
  | "nameRequired"
  | "emailInvalid"
  | "generic"
  | "submitFailed"
  | "rateLimited";

export type ContactFormState = {
  status: "idle" | "success" | "error";
  // A translation key under contact.form.errors, resolved client-side —
  // keeps this action locale-agnostic instead of guessing the caller's
  // locale server-side.
  errorKey?: ContactErrorKey;
};

export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  // Honeypot: real users never fill this hidden field. Bots that
  // autofill every field will, so we silently pretend success.
  if (formData.get("company")) {
    return { status: "success" };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    interest: formData.get("interest"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const errorKey: ContactErrorKey =
      field === "name" ? "nameRequired" : field === "email" ? "emailInvalid" : "generic";
    return { status: "error", errorKey };
  }

  const { name, email, phone, interest, message } = parsed.data;

  const supabase = getSupabaseServerClient();

  const { data: canSubmit, error: rateLimitError } = await supabase.rpc(
    "can_submit_contact_form",
    { p_email: email }
  );

  if (rateLimitError) {
    console.error("can_submit_contact_form failed", rateLimitError);
    return { status: "error", errorKey: "submitFailed" };
  }

  if (!canSubmit) {
    return { status: "error", errorKey: "rateLimited" };
  }

  const { error } = await supabase.from("contact_submissions").insert({
    name,
    email,
    phone: phone || null,
    interest,
    message: message || null,
  });

  if (error) {
    console.error("contact_submissions insert failed", error);
    return { status: "error", errorKey: "submitFailed" };
  }

  return { status: "success" };
}
