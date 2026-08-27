"use server";

import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Ingresá tu nombre.").max(200),
  email: z.string().trim().email("Ingresá un email válido.").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  interest: z.enum(["membresia", "contacto_general"]),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ContactFormState = {
  status: "idle" | "success" | "error";
  message?: string;
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
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    };
  }

  const { name, email, phone, interest, message } = parsed.data;

  const supabase = getSupabaseServerClient();

  const { data: canSubmit, error: rateLimitError } = await supabase.rpc(
    "can_submit_contact_form",
    { p_email: email }
  );

  if (rateLimitError) {
    console.error("can_submit_contact_form failed", rateLimitError);
    return {
      status: "error",
      message: "No pudimos enviar tu mensaje. Probá de nuevo en un momento.",
    };
  }

  if (!canSubmit) {
    return {
      status: "error",
      message: "Ya recibimos tu mensaje. Te vamos a contactar pronto — esperá unos minutos antes de volver a enviar.",
    };
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
    return {
      status: "error",
      message: "No pudimos enviar tu mensaje. Probá de nuevo en un momento.",
    };
  }

  return { status: "success" };
}
