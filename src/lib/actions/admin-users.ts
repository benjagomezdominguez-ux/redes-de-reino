"use server";

import { requireAdmin } from "@/lib/supabase/require-auth";
import { getSupabaseSessionClient } from "@/lib/supabase/session";

// Deactivation is a status change, never a physical delete — see
// admin_set_user_status() in the migration for why: it's the same
// SECURITY DEFINER + auth.uid() pattern already used for create_order()/
// submit_transfer_proof(), so the actor is always the real authenticated
// caller (never trusted from the client), and it's the ONE place "never
// deactivate yourself, never deactivate an admin" is enforced — not
// duplicated per call site.
//
// requireAdmin() here is the same app-level gate every other admin
// action in this project starts with; the RPC re-checks independently
// server-side too (it has to survive being called directly, not just
// through this Server Action). Uses the session client, not the
// service-role client — the RPC's internal auth.uid() capture requires
// the real caller's JWT to be present.

export type SetUserStatusResult =
  | { ok: true; changed: boolean }
  | { ok: false; errorKey: "unauthorized" | "notFound" | "cannotTargetSelf" | "cannotTargetAdmin" | "generic" };

async function setUserStatus(targetUserId: string, newStatus: "active" | "inactive"): Promise<SetUserStatusResult> {
  const admin = await requireAdmin();

  // Fast, friendly path for the one case we can check without a round
  // trip — the RPC enforces this unconditionally regardless.
  if (admin.id === targetUserId) {
    return { ok: false, errorKey: "cannotTargetSelf" };
  }

  const supabase = await getSupabaseSessionClient();
  const { data, error } = await supabase.rpc("admin_set_user_status", {
    p_target_user_id: targetUserId,
    p_new_status: newStatus,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("cannot_target_self")) return { ok: false, errorKey: "cannotTargetSelf" };
    if (message.includes("cannot_target_admin")) return { ok: false, errorKey: "cannotTargetAdmin" };
    if (message.includes("user_not_found")) return { ok: false, errorKey: "notFound" };
    if (message.includes("not_authorized")) return { ok: false, errorKey: "unauthorized" };
    return { ok: false, errorKey: "generic" };
  }

  const result = data as { changed?: boolean } | null;
  return { ok: true, changed: Boolean(result?.changed) };
}

export async function deactivateUser(targetUserId: string): Promise<SetUserStatusResult> {
  return setUserStatus(targetUserId, "inactive");
}

export async function reactivateUser(targetUserId: string): Promise<SetUserStatusResult> {
  return setUserStatus(targetUserId, "active");
}
