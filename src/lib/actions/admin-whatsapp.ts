"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/supabase/require-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isWhatsAppConfigured } from "@/lib/whatsapp/provider";

// Every action here starts with requireAdmin() (rule 3: no client-side
// authorization, ever) and writes through the admin/service-role client,
// since none of the whatsapp_* tables grant any client-side write policy
// — only the "Admins manage ..." RLS policies added in the migration,
// which the session client would also satisfy, but every other admin
// write path in this project already goes through the admin client, so
// this stays consistent with that.

export type WhatsAppActionState = {
  status: "idle" | "error" | "success";
  errorKey?: "generic" | "required" | "invalidPhone" | "duplicatePhone" | "notConfigured";
  id?: string;
};

// ---------- Groups ----------

const groupSchema = z.object({ name: z.string().trim().min(1) });

export async function createGroup(_prevState: WhatsAppActionState, formData: FormData): Promise<WhatsAppActionState> {
  const admin_ = await requireAdmin();
  const parsed = groupSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { status: "error", errorKey: "required" };

  const admin = getSupabaseAdminClient();
  const { data: group, error } = await admin
    .from("whatsapp_groups")
    .insert({ name: parsed.data.name, created_by: admin_.id })
    .select()
    .single();
  if (error || !group) return { status: "error", errorKey: "generic" };

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "whatsapp_group_created",
    resource_type: "whatsapp_group",
    resource_id: group.id,
    metadata: { name: parsed.data.name },
  });

  return { status: "success", id: group.id };
}

export async function setGroupStatus(groupId: string, status: "active" | "inactive"): Promise<void> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  await admin.from("whatsapp_groups").update({ status }).eq("id", groupId);
  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: status === "active" ? "whatsapp_group_activated" : "whatsapp_group_deactivated",
    resource_type: "whatsapp_group",
    resource_id: groupId,
    metadata: { status },
  });
}

// E.164: + followed by 8-15 digits, first digit 1-9 — mirrors the DB
// check constraint so a bad number is rejected here, not just at insert.
const PHONE_E164 = /^\+[1-9][0-9]{7,14}$/;

const contactSchema = z.object({
  groupId: z.string().uuid(),
  phone: z.string().trim(),
  displayName: z.string().trim().optional().or(z.literal("")),
});

export async function addContact(_prevState: WhatsAppActionState, formData: FormData): Promise<WhatsAppActionState> {
  const admin_ = await requireAdmin();
  const parsed = contactSchema.safeParse({
    groupId: formData.get("groupId"),
    phone: formData.get("phone"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) return { status: "error", errorKey: "required" };
  if (!PHONE_E164.test(parsed.data.phone)) return { status: "error", errorKey: "invalidPhone" };

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("whatsapp_contacts").insert({
    group_id: parsed.data.groupId,
    phone_e164: parsed.data.phone,
    display_name: parsed.data.displayName || null,
  });
  if (error) {
    return { status: "error", errorKey: error.code === "23505" ? "duplicatePhone" : "generic" };
  }

  await admin.from("whatsapp_groups").update({ last_activity_at: new Date().toISOString() }).eq("id", parsed.data.groupId);
  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "whatsapp_contact_added",
    resource_type: "whatsapp_group",
    resource_id: parsed.data.groupId,
    metadata: { phone: parsed.data.phone },
  });

  return { status: "success" };
}

export async function removeContact(contactId: string, groupId: string): Promise<void> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  await admin.from("whatsapp_contacts").delete().eq("id", contactId);
  await admin.from("whatsapp_groups").update({ last_activity_at: new Date().toISOString() }).eq("id", groupId);
  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "whatsapp_contact_removed",
    resource_type: "whatsapp_group",
    resource_id: groupId,
    metadata: { contact_id: contactId },
  });
}

// ---------- Campaigns ----------

const campaignSchema = z.object({
  groupId: z.string().uuid(),
  name: z.string().trim().min(1),
  startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  cycleDurationDays: z.string().trim().optional().or(z.literal("")),
  timezone: z.string().trim().min(1),
});

export async function createCampaign(_prevState: WhatsAppActionState, formData: FormData): Promise<WhatsAppActionState> {
  const admin_ = await requireAdmin();
  const parsed = campaignSchema.safeParse({
    groupId: formData.get("groupId"),
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    cycleDurationDays: formData.get("cycleDurationDays"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) return { status: "error", errorKey: "required" };

  const cycleDurationDays = parsed.data.cycleDurationDays ? Number(parsed.data.cycleDurationDays) : 30;
  if (!Number.isFinite(cycleDurationDays) || cycleDurationDays <= 0) {
    return { status: "error", errorKey: "required" };
  }

  const admin = getSupabaseAdminClient();
  const { data: campaign, error } = await admin
    .from("whatsapp_campaigns")
    .insert({
      group_id: parsed.data.groupId,
      name: parsed.data.name,
      start_date: parsed.data.startDate,
      cycle_duration_days: cycleDurationDays,
      timezone: parsed.data.timezone,
      created_by: admin_.id,
    })
    .select()
    .single();
  if (error || !campaign) return { status: "error", errorKey: "generic" };

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "whatsapp_campaign_created",
    resource_type: "whatsapp_campaign",
    resource_id: campaign.id,
    metadata: { name: parsed.data.name, group_id: parsed.data.groupId },
  });

  return { status: "success", id: campaign.id };
}

const messageSchema = z.object({
  campaignId: z.string().uuid(),
  sequencePosition: z.string().trim().regex(/^[1-9][0-9]*$/),
  title: z.string().trim().min(1),
  bodyText: z.string().trim().min(1),
  templateName: z.string().trim().optional().or(z.literal("")),
  templateLanguage: z.string().trim().min(2).max(10).optional().or(z.literal("")),
  scheduledDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z.string().trim().regex(/^\d{2}:\d{2}$/),
});

// Only lets content change while the campaign hasn't started running
// (draft) or is paused — editing an active/completed/cancelled campaign's
// messages would let the content of an already-in-flight send drift
// under the admin's feet mid-cycle.
async function assertCampaignEditable(campaignId: string): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("whatsapp_campaigns").select("status").eq("id", campaignId).maybeSingle();
  return Boolean(data) && (data!.status === "draft" || data!.status === "paused");
}

export async function saveMessage(_prevState: WhatsAppActionState, formData: FormData): Promise<WhatsAppActionState> {
  const admin_ = await requireAdmin();
  const parsed = messageSchema.safeParse({
    campaignId: formData.get("campaignId"),
    sequencePosition: formData.get("sequencePosition"),
    title: formData.get("title"),
    bodyText: formData.get("bodyText"),
    templateName: formData.get("templateName"),
    templateLanguage: formData.get("templateLanguage"),
    scheduledDate: formData.get("scheduledDate"),
    scheduledTime: formData.get("scheduledTime"),
  });
  if (!parsed.success) return { status: "error", errorKey: "required" };

  if (!(await assertCampaignEditable(parsed.data.campaignId))) {
    return { status: "error", errorKey: "generic" };
  }

  const admin = getSupabaseAdminClient();
  const { data: message, error } = await admin
    .from("whatsapp_messages")
    .upsert(
      {
        campaign_id: parsed.data.campaignId,
        sequence_position: Number(parsed.data.sequencePosition),
        title: parsed.data.title,
        body_text: parsed.data.bodyText,
        whatsapp_template_name: parsed.data.templateName || null,
        whatsapp_template_language: parsed.data.templateLanguage || "es",
        scheduled_date: parsed.data.scheduledDate,
        scheduled_time: parsed.data.scheduledTime,
      },
      { onConflict: "campaign_id,sequence_position" }
    )
    .select()
    .single();
  if (error || !message) return { status: "error", errorKey: "generic" };

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "whatsapp_message_saved",
    resource_type: "whatsapp_message",
    resource_id: message.id,
    metadata: { campaign_id: parsed.data.campaignId, position: parsed.data.sequencePosition },
  });

  return { status: "success", id: message.id };
}

export type WhatsAppUploadUrlResult =
  | { ok: true; bucket: "whatsapp-media"; path: string; token: string }
  | { ok: false };

// Signed direct-to-Storage upload, same reasoning as book covers/files
// (src/lib/actions/admin-books.ts) — bytes never pass through a Server
// Action body.
export async function requestMessageImageUploadUrl(campaignId: string, extension: string): Promise<WhatsAppUploadUrlResult> {
  await requireAdmin();

  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").slice(0, 10) || "bin";
  const path = `${campaignId}/${randomUUID()}.${safeExtension}`;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage.from("whatsapp-media").createSignedUploadUrl(path);
  if (error || !data) return { ok: false };

  return { ok: true, bucket: "whatsapp-media", path: data.path, token: data.token };
}

export async function attachMessageImage(messageId: string, path: string): Promise<{ ok: boolean }> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  const { error } = await admin.from("whatsapp_messages").update({ image_storage_path: path }).eq("id", messageId);
  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "whatsapp_message_image_updated",
    resource_type: "whatsapp_message",
    resource_id: messageId,
    metadata: {},
  });

  return { ok: !error };
}

// ---------- Campaign lifecycle ----------

export type ActivateResult = { ok: boolean; errorKey?: "notConfigured" | "incomplete" | "noContacts" };

// Rule 39: refuses to activate unless every precondition actually holds
// — never lets a campaign show as ACTIVE while unable to really send.
export async function activateCampaign(campaignId: string): Promise<ActivateResult> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  if (!isWhatsAppConfigured()) {
    return { ok: false, errorKey: "notConfigured" };
  }

  const { data: campaign } = await admin
    .from("whatsapp_campaigns")
    .select("id, group_id, status")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign || (campaign.status !== "draft" && campaign.status !== "paused")) {
    return { ok: false, errorKey: "incomplete" };
  }

  const { count: contactCount } = await admin
    .from("whatsapp_contacts")
    .select("*", { count: "exact", head: true })
    .eq("group_id", campaign.group_id);
  if (!contactCount || contactCount === 0) {
    return { ok: false, errorKey: "noContacts" };
  }

  const { data: messages } = await admin
    .from("whatsapp_messages")
    .select("sequence_position, title, body_text, image_storage_path, scheduled_date, scheduled_time")
    .eq("campaign_id", campaignId)
    .order("sequence_position", { ascending: true });

  // Exactly 4 messages, at positions 1..4 (rule 40), each complete.
  const positions = (messages ?? []).map((m) => m.sequence_position);
  const hasExactlyFour = positions.length === 4 && [1, 2, 3, 4].every((p) => positions.includes(p));
  const allComplete = (messages ?? []).every(
    (m) => m.title && m.body_text && m.image_storage_path && m.scheduled_date && m.scheduled_time
  );
  if (!hasExactlyFour || !allComplete) {
    return { ok: false, errorKey: "incomplete" };
  }

  await admin.from("whatsapp_campaigns").update({ status: "active" }).eq("id", campaignId);
  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "whatsapp_campaign_activated",
    resource_type: "whatsapp_campaign",
    resource_id: campaignId,
    metadata: {},
  });

  return { ok: true };
}

export async function pauseCampaign(campaignId: string): Promise<void> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  await admin
    .from("whatsapp_campaigns")
    .update({ status: "paused", paused_by: admin_.id, paused_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("status", "active");

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "whatsapp_campaign_paused",
    resource_type: "whatsapp_campaign",
    resource_id: campaignId,
    metadata: {},
  });
}

export async function resumeCampaign(campaignId: string): Promise<void> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  await admin
    .from("whatsapp_campaigns")
    .update({ status: "active", paused_by: null, paused_at: null })
    .eq("id", campaignId)
    .eq("status", "paused");

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "whatsapp_campaign_resumed",
    resource_type: "whatsapp_campaign",
    resource_id: campaignId,
    metadata: {},
  });
}

export async function cancelCampaign(campaignId: string, reason: string): Promise<void> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  await admin
    .from("whatsapp_campaigns")
    .update({
      status: "cancelled",
      cancelled_by: admin_.id,
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason || null,
    })
    .eq("id", campaignId)
    .in("status", ["draft", "scheduled", "active", "paused"]);

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "whatsapp_campaign_cancelled",
    resource_type: "whatsapp_campaign",
    resource_id: campaignId,
    metadata: { reason: reason || null },
  });
}
