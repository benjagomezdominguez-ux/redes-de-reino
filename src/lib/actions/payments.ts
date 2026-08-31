"use server";

import { z } from "zod";
import { getSupabaseSessionClient } from "@/lib/supabase/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const proofSchema = z.object({
  orderId: z.string().uuid(),
  operationNumber: z.string().trim().max(100).optional().or(z.literal("")),
  declaredAmount: z.string().trim().optional().or(z.literal("")),
  declaredDate: z.string().trim().optional().or(z.literal("")),
});

export type TransferProofState = {
  status: "idle" | "error" | "success";
  errorKey?: "generic" | "unauthorized";
};

const MAX_PROOF_BYTES = 8 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// A proof is evidence, never a payment confirmation by itself (rule 21).
// This only ever writes to the caller's OWN still-pending payment —
// enforced twice: once here (a defense-in-depth ownership check before
// touching Storage) and again, unconditionally, inside the
// submit_transfer_proof() database function itself.
export async function submitTransferProof(
  _prevState: TransferProofState,
  formData: FormData
): Promise<TransferProofState> {
  const supabase = await getSupabaseSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", errorKey: "unauthorized" };
  }

  const parsed = proofSchema.safeParse({
    orderId: formData.get("order_id"),
    operationNumber: formData.get("operation_number"),
    declaredAmount: formData.get("declared_amount"),
    declaredDate: formData.get("declared_date"),
  });
  if (!parsed.success) {
    return { status: "error", errorKey: "generic" };
  }

  // The session client's RLS ("own orders only") is what actually
  // prevents this from resolving another user's payment — this query
  // simply can't return a row that isn't the caller's.
  const { data: payment } = await supabase
    .from("payments")
    .select("id, order_id, method, status")
    .eq("order_id", parsed.data.orderId)
    .maybeSingle();

  if (!payment || payment.method !== "bank_transfer" || payment.status !== "pending") {
    return { status: "error", errorKey: "unauthorized" };
  }

  let proofStoragePath: string | null = null;
  const file = formData.get("proof_file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PROOF_BYTES || !ALLOWED_PROOF_TYPES.includes(file.type)) {
      return { status: "error", errorKey: "generic" };
    }
    const admin = getSupabaseAdminClient();
    const extension = file.name.split(".").pop() ?? "bin";
    proofStoragePath = `${payment.order_id}/${payment.id}-${Date.now()}.${extension}`;
    const { error: uploadError } = await admin.storage
      .from("payment-proofs")
      .upload(proofStoragePath, file, { contentType: file.type });
    if (uploadError) {
      return { status: "error", errorKey: "generic" };
    }
  }

  const declaredAmountCents = parsed.data.declaredAmount
    ? Math.round(Number(parsed.data.declaredAmount) * 100)
    : null;

  const { error } = await supabase.rpc("submit_transfer_proof", {
    p_payment_id: payment.id,
    p_operation_number: parsed.data.operationNumber || null,
    p_declared_amount_cents: Number.isFinite(declaredAmountCents) ? declaredAmountCents : null,
    p_declared_at: parsed.data.declaredDate || null,
    p_proof_storage_path: proofStoragePath,
  });

  if (error) {
    return { status: "error", errorKey: "generic" };
  }

  return { status: "success" };
}
