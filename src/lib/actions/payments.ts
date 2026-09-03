"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getSupabaseSessionClient } from "@/lib/supabase/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthProfile } from "@/lib/supabase/get-profile";

const proofSchema = z.object({
  orderId: z.string().uuid(),
  operationNumber: z.string().trim().max(100).optional().or(z.literal("")),
  declaredAmount: z.string().trim().optional().or(z.literal("")),
  declaredDate: z.string().trim().optional().or(z.literal("")),
  proofPath: z.string().trim().optional().or(z.literal("")),
});

export type TransferProofState = {
  status: "idle" | "error" | "success";
  errorKey?: "generic" | "unauthorized";
};

// Looks up the caller's own pending bank-transfer payment for an order.
// The session client's RLS ("own orders only") is what actually prevents
// this from ever resolving another user's payment — this query simply
// can't return a row that isn't the caller's.
async function getOwnPendingTransfer(orderId: string) {
  // A deactivated account can't attach new proof to a pending transfer
  // either — same status check as every other protected write here.
  const profile = await getAuthProfile();
  if (!profile || profile.status !== "active") return null;

  const supabase = await getSupabaseSessionClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, order_id, method, status")
    .eq("order_id", orderId)
    .maybeSingle();

  if (!payment || payment.method !== "bank_transfer" || payment.status !== "pending") {
    return null;
  }
  return payment;
}

export type ProofUploadUrlResult =
  | { ok: true; bucket: "payment-proofs"; path: string; token: string }
  | { ok: false };

// Mints a short-lived signed upload URL so the browser can send the
// proof file straight to Storage — never through this Server Action's
// body. A phone screenshot of a transfer routinely exceeds Next's
// default 1MB Server Action limit (and Vercel's own ~4.5MB hard ceiling,
// which no next.config setting can raise), so the old "upload the File
// object through FormData" approach would fail on exactly the kind of
// evidence buyers actually attach.
export async function requestTransferProofUploadUrl(
  orderId: string,
  extension: string
): Promise<ProofUploadUrlResult> {
  const payment = await getOwnPendingTransfer(orderId);
  if (!payment) return { ok: false };

  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").slice(0, 10) || "bin";
  const path = `${orderId}/${payment.id}-${randomUUID()}.${safeExtension}`;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage.from("payment-proofs").createSignedUploadUrl(path);
  if (error || !data) return { ok: false };

  return { ok: true, bucket: "payment-proofs", path: data.path, token: data.token };
}

// A proof is evidence, never a payment confirmation by itself (rule 21).
// Only ever writes to the caller's own still-pending payment — enforced
// both here and, unconditionally, inside submit_transfer_proof() itself.
export async function submitTransferProof(
  _prevState: TransferProofState,
  formData: FormData
): Promise<TransferProofState> {
  const parsed = proofSchema.safeParse({
    orderId: formData.get("order_id"),
    operationNumber: formData.get("operation_number"),
    declaredAmount: formData.get("declared_amount"),
    declaredDate: formData.get("declared_date"),
    proofPath: formData.get("proof_path"),
  });
  if (!parsed.success) {
    return { status: "error", errorKey: "generic" };
  }

  const payment = await getOwnPendingTransfer(parsed.data.orderId);
  if (!payment) {
    return { status: "error", errorKey: "unauthorized" };
  }

  const declaredAmountCents = parsed.data.declaredAmount
    ? Math.round(Number(parsed.data.declaredAmount) * 100)
    : null;

  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase.rpc("submit_transfer_proof", {
    p_payment_id: payment.id,
    p_operation_number: parsed.data.operationNumber || null,
    p_declared_amount_cents: Number.isFinite(declaredAmountCents) ? declaredAmountCents : null,
    p_declared_at: parsed.data.declaredDate || null,
    p_proof_storage_path: parsed.data.proofPath || null,
  });

  if (error) {
    return { status: "error", errorKey: "generic" };
  }

  return { status: "success" };
}
