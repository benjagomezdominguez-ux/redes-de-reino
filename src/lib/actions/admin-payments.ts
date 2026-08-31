"use server";

import { requireAdmin } from "@/lib/supabase/require-auth";
import { getSupabaseSessionClient } from "@/lib/supabase/session";

export type AdminPaymentActionState = {
  status: "idle" | "error" | "success";
  errorKey?: "generic";
};

// The actual authorization + amount-vs-declared check both live in the
// admin_confirm_bank_transfer() database function (rule 22/23) — this
// Server Action's requireAdmin() call is a fast UX-level gate, not the
// real one. Even if it were skipped, the RPC itself re-checks
// is_admin(auth.uid()) before doing anything.
export async function confirmBankTransfer(
  _prevState: AdminPaymentActionState,
  formData: FormData
): Promise<AdminPaymentActionState> {
  await requireAdmin();
  const paymentId = formData.get("payment_id");
  const notes = formData.get("notes");
  if (typeof paymentId !== "string" || !paymentId) {
    return { status: "error", errorKey: "generic" };
  }

  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase.rpc("admin_confirm_bank_transfer", {
    p_payment_id: paymentId,
    p_notes: typeof notes === "string" && notes ? notes : null,
  });

  if (error) {
    return { status: "error", errorKey: "generic" };
  }
  return { status: "success" };
}

export async function rejectBankTransfer(
  _prevState: AdminPaymentActionState,
  formData: FormData
): Promise<AdminPaymentActionState> {
  await requireAdmin();
  const paymentId = formData.get("payment_id");
  const notes = formData.get("notes");
  if (typeof paymentId !== "string" || !paymentId) {
    return { status: "error", errorKey: "generic" };
  }

  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase.rpc("admin_reject_bank_transfer", {
    p_payment_id: paymentId,
    p_notes: typeof notes === "string" && notes ? notes : null,
  });

  if (error) {
    return { status: "error", errorKey: "generic" };
  }
  return { status: "success" };
}
