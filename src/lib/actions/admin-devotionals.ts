"use server";

import { requireChatAdmin } from "@/lib/supabase/require-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyDevotionalPublished, removeDevotionalNotifications } from "@/lib/notifications/devotionals";

// Devotionals are administered exclusively by Ariel Gómez — the same
// real person requireChatAdmin() already gates chat/push behind (see
// is-chat-admin.ts). Reused as-is rather than inventing a second "is
// this the right admin" check for the same one person. Every action
// starts with it, server-side, on every call — never trusting that a
// button was only rendered for Ariel. Writes use the admin/service-role
// client because devotionals has no insert/update/delete RLS policy for
// any client role — same pattern as every other admin write here.

export type DevotionalActionResult =
  | { ok: true; id: string }
  | { ok: false; errorKey: "required" | "notFound" | "generic" };

type DevotionalInput = { title: string; content: string; status: "draft" | "published" };

function isValid(input: DevotionalInput): boolean {
  return input.title.trim().length > 0 && input.content.trim().length > 0;
}

export async function createDevotional(input: DevotionalInput): Promise<DevotionalActionResult> {
  const admin_ = await requireChatAdmin();
  if (!isValid(input)) return { ok: false, errorKey: "required" };

  const admin = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await admin
    .from("devotionals")
    .insert({
      title: input.title.trim(),
      content: input.content.trim(),
      status: input.status,
      author_id: admin_.id,
      published_at: input.status === "published" ? nowIso : null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, errorKey: "generic" };

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: input.status === "published" ? "devotional_published" : "devotional_created",
    resource_type: "devotional",
    resource_id: data.id,
    metadata: { status: input.status },
  });

  // A brand-new devotional created with status "published" is always a
  // first-time publish (there is no prior state to compare against).
  if (input.status === "published") {
    await notifyDevotionalPublished(data.id, admin_.id);
  }

  return { ok: true, id: data.id };
}

export async function updateDevotional(id: string, input: DevotionalInput): Promise<DevotionalActionResult> {
  const admin_ = await requireChatAdmin();
  if (!isValid(input)) return { ok: false, errorKey: "required" };

  const admin = getSupabaseAdminClient();
  const { data: existing } = await admin.from("devotionals").select("status, published_at").eq("id", id).maybeSingle();
  if (!existing) return { ok: false, errorKey: "notFound" };

  // Captured before the update below — never read existing.status after
  // that point.
  const previousStatus = existing.status;

  const nowIso = new Date().toISOString();
  // Only stamp published_at the moment a devotional first becomes
  // published — editing an already-published one, or one that was
  // published before and is being republished, keeps its original date
  // rather than looking newly posted every time it's touched.
  const becomingPublished = input.status === "published" && previousStatus !== "published";
  const publishedAt = becomingPublished ? nowIso : existing.published_at;

  const { error } = await admin
    .from("devotionals")
    .update({
      title: input.title.trim(),
      content: input.content.trim(),
      status: input.status,
      updated_at: nowIso,
      published_at: publishedAt,
    })
    .eq("id", id);

  if (error) return { ok: false, errorKey: "generic" };

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "devotional_updated",
    resource_type: "devotional",
    resource_id: id,
    metadata: { status: input.status },
  });

  if (becomingPublished) {
    await notifyDevotionalPublished(id, admin_.id);
  } else if (previousStatus === "published" && input.status === "draft") {
    // Unpublishing via edit makes it inaccessible the same way deleting
    // it does (getPublishedDevotionalById returns null either way) — a
    // stale notification pointing at it would 404 just the same.
    await removeDevotionalNotifications(id);
  }

  return { ok: true, id };
}

export async function setDevotionalStatus(id: string, status: "draft" | "published"): Promise<{ ok: boolean }> {
  const admin_ = await requireChatAdmin();
  const admin = getSupabaseAdminClient();

  const { data: existing } = await admin.from("devotionals").select("status, published_at").eq("id", id).maybeSingle();
  if (!existing) return { ok: false };

  // Captured before the update below — never read existing.status after
  // that point.
  const previousStatus = existing.status;

  const nowIso = new Date().toISOString();
  const becomingPublished = status === "published" && previousStatus !== "published";
  const publishedAt = becomingPublished ? nowIso : existing.published_at;

  const { error } = await admin
    .from("devotionals")
    .update({ status, updated_at: nowIso, published_at: publishedAt })
    .eq("id", id);
  if (error) return { ok: false };

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: status === "published" ? "devotional_published" : "devotional_unpublished",
    resource_type: "devotional",
    resource_id: id,
    metadata: { status },
  });

  if (becomingPublished) {
    await notifyDevotionalPublished(id, admin_.id);
  } else if (previousStatus === "published" && status === "draft") {
    await removeDevotionalNotifications(id);
  }

  return { ok: true };
}

export async function deleteDevotional(id: string): Promise<{ ok: boolean }> {
  const admin_ = await requireChatAdmin();
  const admin = getSupabaseAdminClient();

  const { data: existing } = await admin.from("devotionals").select("id").eq("id", id).maybeSingle();
  if (!existing) return { ok: false };

  const { error } = await admin.from("devotionals").delete().eq("id", id);
  if (error) return { ok: false };

  // The devotional is gone — any notification still pointing at it would
  // now 404 if clicked (this is the real bug that was reported: stale
  // notifications from earlier deletes, never cleaned up, sent real
  // users to a dead link).
  await removeDevotionalNotifications(id);

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "devotional_deleted",
    resource_type: "devotional",
    resource_id: id,
    metadata: {},
  });

  return { ok: true };
}
