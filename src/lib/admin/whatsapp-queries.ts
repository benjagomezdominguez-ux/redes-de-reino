import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Reads use the admin/service-role client, same reasoning as
// book-queries.ts: every caller here is already behind requireAdmin() at
// the /admin/whatsapp layout level, and some of these joins are awkward
// to express as RLS-safe session-client queries.

export type WhatsAppGroupRow = {
  id: string;
  name: string;
  status: "active" | "inactive";
  created_at: string;
  last_activity_at: string;
  contact_count: number;
  latest_campaign: { id: string; name: string; status: string; end_date: string } | null;
};

export async function listGroups(): Promise<WhatsAppGroupRow[]> {
  const admin = getSupabaseAdminClient();
  const { data: groups } = await admin
    .from("whatsapp_groups")
    .select("id, name, status, created_at, last_activity_at")
    .order("created_at", { ascending: false });

  if (!groups || groups.length === 0) return [];

  const groupIds = groups.map((g) => g.id);

  const { data: contacts } = await admin.from("whatsapp_contacts").select("group_id").in("group_id", groupIds);
  const contactCounts = new Map<string, number>();
  for (const c of contacts ?? []) {
    contactCounts.set(c.group_id, (contactCounts.get(c.group_id) ?? 0) + 1);
  }

  const { data: campaigns } = await admin
    .from("whatsapp_campaigns")
    .select("id, group_id, name, status, end_date, created_at")
    .in("group_id", groupIds)
    .order("created_at", { ascending: false });

  const latestCampaignByGroup = new Map<string, { id: string; name: string; status: string; end_date: string }>();
  for (const c of campaigns ?? []) {
    if (!latestCampaignByGroup.has(c.group_id)) {
      latestCampaignByGroup.set(c.group_id, { id: c.id, name: c.name, status: c.status, end_date: c.end_date });
    }
  }

  return groups.map((g) => ({
    ...g,
    status: g.status as "active" | "inactive",
    contact_count: contactCounts.get(g.id) ?? 0,
    latest_campaign: latestCampaignByGroup.get(g.id) ?? null,
  }));
}

export type WhatsAppContactRow = { id: string; phone_e164: string; display_name: string | null; created_at: string };
export type WhatsAppCampaignSummary = { id: string; name: string; status: string; start_date: string; end_date: string };

export async function getGroupDetail(
  groupId: string
): Promise<{ group: { id: string; name: string; status: string }; contacts: WhatsAppContactRow[]; campaigns: WhatsAppCampaignSummary[] } | null> {
  const admin = getSupabaseAdminClient();
  const { data: group } = await admin.from("whatsapp_groups").select("id, name, status").eq("id", groupId).maybeSingle();
  if (!group) return null;

  const { data: contacts } = await admin
    .from("whatsapp_contacts")
    .select("id, phone_e164, display_name, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  const { data: campaigns } = await admin
    .from("whatsapp_campaigns")
    .select("id, name, status, start_date, end_date")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  return {
    group,
    contacts: (contacts ?? []) as WhatsAppContactRow[],
    campaigns: (campaigns ?? []) as WhatsAppCampaignSummary[],
  };
}

export type WhatsAppMessageRow = {
  id: string;
  sequence_position: number;
  title: string;
  body_text: string;
  image_storage_path: string | null;
  image_url: string | null;
  whatsapp_template_name: string | null;
  whatsapp_template_language: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  sent_count: number;
  failed_count: number;
  total_recipients: number;
};

export type WhatsAppCampaignDetail = {
  campaign: {
    id: string;
    group_id: string;
    group_name: string;
    name: string;
    status: string;
    start_date: string;
    end_date: string;
    cycle_duration_days: number;
    timezone: string;
  };
  messages: WhatsAppMessageRow[];
};

export async function getCampaignDetail(campaignId: string): Promise<WhatsAppCampaignDetail | null> {
  const admin = getSupabaseAdminClient();
  const { data: campaign } = await admin
    .from("whatsapp_campaigns")
    .select("id, group_id, name, status, start_date, end_date, cycle_duration_days, timezone, whatsapp_groups(name)")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) return null;

  const groupRel = campaign.whatsapp_groups as unknown as { name: string } | { name: string }[] | null;
  const groupName = Array.isArray(groupRel) ? groupRel[0]?.name : groupRel?.name;

  const { data: messages } = await admin
    .from("whatsapp_messages")
    .select("id, sequence_position, title, body_text, image_storage_path, whatsapp_template_name, whatsapp_template_language, scheduled_date, scheduled_time, status")
    .eq("campaign_id", campaignId)
    .order("sequence_position", { ascending: true });

  const messageIds = (messages ?? []).map((m) => m.id);
  const { data: deliveries } = messageIds.length
    ? await admin.from("whatsapp_message_deliveries").select("message_id, status").in("message_id", messageIds)
    : { data: [] };

  const deliveryCounts = new Map<string, { total: number; sent: number; failed: number }>();
  for (const d of deliveries ?? []) {
    const entry = deliveryCounts.get(d.message_id) ?? { total: 0, sent: 0, failed: 0 };
    entry.total += 1;
    if (d.status === "sent") entry.sent += 1;
    if (d.status === "failed") entry.failed += 1;
    deliveryCounts.set(d.message_id, entry);
  }

  const messageRows: WhatsAppMessageRow[] = await Promise.all(
    (messages ?? []).map(async (m) => {
      let imageUrl: string | null = null;
      if (m.image_storage_path) {
        const { data } = await admin.storage.from("whatsapp-media").createSignedUrl(m.image_storage_path, 300);
        imageUrl = data?.signedUrl ?? null;
      }
      const counts = deliveryCounts.get(m.id) ?? { total: 0, sent: 0, failed: 0 };
      return {
        ...m,
        image_url: imageUrl,
        sent_count: counts.sent,
        failed_count: counts.failed,
        total_recipients: counts.total,
      };
    })
  );

  return {
    campaign: {
      id: campaign.id,
      group_id: campaign.group_id,
      group_name: groupName ?? "",
      name: campaign.name,
      status: campaign.status,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      cycle_duration_days: campaign.cycle_duration_days,
      timezone: campaign.timezone,
    },
    messages: messageRows,
  };
}

export type WhatsAppDashboardCounts = {
  activeGroups: number;
  activeCampaigns: number;
  nextMessage: { scheduled_date: string; scheduled_time: string; campaign_name: string; group_name: string } | null;
  nextAlertDate: string | null;
};

export async function getWhatsAppDashboardCounts(): Promise<WhatsAppDashboardCounts> {
  const admin = getSupabaseAdminClient();

  const [{ count: activeGroups }, { data: activeCampaigns }] = await Promise.all([
    admin.from("whatsapp_groups").select("*", { count: "exact", head: true }).eq("status", "active"),
    admin
      .from("whatsapp_campaigns")
      .select("id, name, end_date, whatsapp_groups(name)")
      .eq("status", "active"),
  ]);

  const campaignIds = (activeCampaigns ?? []).map((c) => c.id);

  let nextMessage: WhatsAppDashboardCounts["nextMessage"] = null;
  if (campaignIds.length > 0) {
    const { data: nextMsg } = await admin
      .from("whatsapp_messages")
      .select("scheduled_date, scheduled_time, campaign_id, whatsapp_campaigns(name, whatsapp_groups(name))")
      .in("campaign_id", campaignIds)
      .eq("status", "scheduled")
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextMsg) {
      const campaignRel = nextMsg.whatsapp_campaigns as unknown as
        | { name: string; whatsapp_groups: { name: string } | { name: string }[] | null }
        | { name: string; whatsapp_groups: { name: string } | { name: string }[] | null }[]
        | null;
      const campaign = Array.isArray(campaignRel) ? campaignRel[0] : campaignRel;
      const groupRel = campaign?.whatsapp_groups;
      const group = Array.isArray(groupRel) ? groupRel[0] : groupRel;
      nextMessage = {
        scheduled_date: nextMsg.scheduled_date,
        scheduled_time: nextMsg.scheduled_time,
        campaign_name: campaign?.name ?? "",
        group_name: group?.name ?? "",
      };
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcomingEndDates = (activeCampaigns ?? [])
    .map((c) => c.end_date as string)
    .filter((endDate) => endDate >= today)
    .sort();
  const nextAlertDate =
    upcomingEndDates.length > 0
      ? new Date(new Date(upcomingEndDates[0]).getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : null;

  return {
    activeGroups: activeGroups ?? 0,
    activeCampaigns: (activeCampaigns ?? []).length,
    nextMessage,
    nextAlertDate,
  };
}
