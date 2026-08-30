import "server-only";
import { getSupabaseSessionClient } from "@/lib/supabase/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type DigitalAccessResult =
  | { granted: true; url: string }
  | { granted: false; reason: "unauthenticated" | "no_entitlement" | "no_file" };

const SIGNED_URL_TTL_SECONDS = 60;

// The full chain from rule 11: authenticated? -> entitlement exists and
// granted? -> file exists? -> mint a short-lived signed URL. Any failure
// denies access; nothing here ever falls back to a public URL.
//
// The entitlement lookup goes through the session-scoped client (RLS:
// "auth.uid() = user_id") rather than the admin client — so even a bug
// in this function's own filtering can't leak another user's access,
// because Postgres itself won't return rows that aren't the caller's.
// The admin client is only used afterwards, for the two things that
// genuinely require bypassing RLS: reading product_files (which has no
// public policies at all) and signing the storage URL.
export async function resolveDigitalAccessUrl(
  productId: string
): Promise<DigitalAccessResult> {
  const session = await getSupabaseSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return { granted: false, reason: "unauthenticated" };
  }

  const { data: entitlement } = await session
    .from("digital_entitlements")
    .select("id")
    .eq("product_id", productId)
    .eq("status", "granted")
    .maybeSingle();

  if (!entitlement) {
    return { granted: false, reason: "no_entitlement" };
  }

  const admin = getSupabaseAdminClient();

  const { data: file } = await admin
    .from("product_files")
    .select("storage_path")
    .eq("product_id", productId)
    .maybeSingle();

  if (!file) {
    return { granted: false, reason: "no_file" };
  }

  const { data: signed, error } = await admin.storage
    .from("book-files")
    .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS);

  if (error || !signed) {
    return { granted: false, reason: "no_file" };
  }

  return { granted: true, url: signed.signedUrl };
}
