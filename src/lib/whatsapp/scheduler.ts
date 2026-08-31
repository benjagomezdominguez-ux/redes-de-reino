import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWhatsAppProvider } from "./provider";
import { getEmailProvider } from "@/lib/email/provider";

const MAX_ATTEMPTS = Number(process.env.WHATSAPP_MAX_RETRY_ATTEMPTS ?? 3);

function nowInTimezone(timezone: string): { date: string; time: string } {
  const now = new Date();
  // en-CA renders as YYYY-MM-DD; en-GB + hour12:false renders as HH:MM —
  // both directly comparable to the date/time columns without parsing.
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  return { date, time };
}

function isDue(scheduledDate: string, scheduledTime: string, todayDate: string, nowTime: string): boolean {
  if (scheduledDate < todayDate) return true;
  if (scheduledDate > todayDate) return false;
  return scheduledTime.slice(0, 5) <= nowTime;
}

function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((new Date(`${toDate}T00:00:00Z`).getTime() - new Date(`${fromDate}T00:00:00Z`).getTime()) / 86400000);
}

// Rule 21: never hardcode an email — search the real profiles table for
// the admin named Benjamín Gómez. Accent/case-insensitive because the
// stored values are plain ASCII lowercase ("benjamin" / "gomez").
export async function findBenjaminGomezEmail(): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("role", "admin")
    .eq("status", "active")
    .ilike("first_name", "benjam%")
    .ilike("last_name", "%gomez%")
    .limit(1)
    .maybeSingle();
  return data?.email ?? null;
}

export type SchedulerSummary = {
  campaignsProcessed: number;
  campaignsCompleted: number;
  messagesSent: number;
  messagesFailed: number;
  deliveriesSent: number;
  deliveriesFailed: number;
  alertsSent: number;
};

// The one entry point the cron route calls. Safe to call any number of
// times in any order — idempotent per rule 13 (a delivery row is only
// ever sent once it reaches 'sent'; re-running never re-sends it) and
// per rule 23 (a cycle-ending alert is inserted with a unique constraint
// on campaign_id, so a duplicate run can't double-send the email).
export async function runWhatsappScheduler(): Promise<SchedulerSummary> {
  const admin = getSupabaseAdminClient();
  const summary: SchedulerSummary = {
    campaignsProcessed: 0,
    campaignsCompleted: 0,
    messagesSent: 0,
    messagesFailed: 0,
    deliveriesSent: 0,
    deliveriesFailed: 0,
    alertsSent: 0,
  };

  const { data: activeCampaigns } = await admin
    .from("whatsapp_campaigns")
    .select("id, group_id, timezone, end_date")
    .eq("status", "active");

  const provider = getWhatsAppProvider();

  for (const campaign of activeCampaigns ?? []) {
    summary.campaignsProcessed += 1;
    const { date: today, time: nowTime } = nowInTimezone(campaign.timezone);

    const { data: messages } = await admin
      .from("whatsapp_messages")
      .select("id, sequence_position, body_text, image_storage_path, whatsapp_template_name, whatsapp_template_language, scheduled_date, scheduled_time, status")
      .eq("campaign_id", campaign.id)
      .order("sequence_position", { ascending: true });

    const orderedMessages = messages ?? [];
    // Rule 12: strict order. The "current" message is the first one not
    // yet terminal — nothing after it is ever touched this run.
    const current = orderedMessages.find((m) => m.status === "scheduled" || m.status === "processing");

    if (!current) {
      // Every message is terminal (sent/failed/cancelled) — the cycle is
      // over (rule 25). No further messages are ever sent automatically.
      if (orderedMessages.length > 0) {
        await admin
          .from("whatsapp_campaigns")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", campaign.id)
          .eq("status", "active");
        await admin.from("audit_log").insert({
          action: "whatsapp_campaign_completed",
          resource_type: "whatsapp_campaign",
          resource_id: campaign.id,
          metadata: {},
        });
        summary.campaignsCompleted += 1;
      }
    } else if (current.status === "scheduled" && !isDue(current.scheduled_date, current.scheduled_time, today, nowTime)) {
      // Not due yet — nothing to do for this campaign this run.
    } else if (provider) {
      if (current.status === "scheduled") {
        await admin.from("whatsapp_messages").update({ status: "processing" }).eq("id", current.id);
      }

      const { data: contacts } = await admin.from("whatsapp_contacts").select("id, phone_e164").eq("group_id", campaign.group_id);

      // Ensure a delivery row exists for every contact — the unique
      // (message_id, contact_id) constraint makes this safe to repeat.
      for (const contact of contacts ?? []) {
        await admin
          .from("whatsapp_message_deliveries")
          .upsert({ message_id: current.id, contact_id: contact.id }, { onConflict: "message_id,contact_id", ignoreDuplicates: true });
      }

      const { data: pendingDeliveries } = await admin
        .from("whatsapp_message_deliveries")
        .select("id, contact_id, attempt_count, whatsapp_contacts(phone_e164)")
        .eq("message_id", current.id)
        .in("status", ["pending", "failed"])
        .lt("attempt_count", MAX_ATTEMPTS);

      for (const delivery of pendingDeliveries ?? []) {
        const contactRel = delivery.whatsapp_contacts as unknown as { phone_e164: string } | { phone_e164: string }[] | null;
        const phone = Array.isArray(contactRel) ? contactRel[0]?.phone_e164 : contactRel?.phone_e164;
        if (!phone) continue;

        const result = await provider.sendMessage({
          to: phone,
          text: current.body_text,
          imageStoragePath: current.image_storage_path,
          templateName: current.whatsapp_template_name,
          templateLanguage: current.whatsapp_template_language,
        });

        const newAttemptCount = delivery.attempt_count + 1;
        if (result.ok) {
          await admin
            .from("whatsapp_message_deliveries")
            .update({
              status: "sent",
              external_message_id: result.externalId,
              sent_at: new Date().toISOString(),
              attempt_count: newAttemptCount,
              last_attempt_at: new Date().toISOString(),
              error_code: null,
              error_message: null,
            })
            .eq("id", delivery.id);
          summary.deliveriesSent += 1;
        } else {
          const exhausted = newAttemptCount >= MAX_ATTEMPTS;
          await admin
            .from("whatsapp_message_deliveries")
            .update({
              status: exhausted ? "failed" : "pending",
              attempt_count: newAttemptCount,
              last_attempt_at: new Date().toISOString(),
              error_code: result.errorCode,
              error_message: result.errorMessage,
            })
            .eq("id", delivery.id);
          if (exhausted) summary.deliveriesFailed += 1;
        }
      }

      // A message is only terminal once no delivery is still retryable.
      const { data: remaining } = await admin
        .from("whatsapp_message_deliveries")
        .select("id, status")
        .eq("message_id", current.id)
        .in("status", ["pending", "processing"]);

      if (!remaining || remaining.length === 0) {
        const { data: allDeliveries } = await admin.from("whatsapp_message_deliveries").select("status").eq("message_id", current.id);
        const anyFailed = (allDeliveries ?? []).some((d) => d.status === "failed");
        const finalStatus = anyFailed ? "failed" : "sent";
        await admin.from("whatsapp_messages").update({ status: finalStatus }).eq("id", current.id);
        if (finalStatus === "sent") summary.messagesSent += 1;
        else summary.messagesFailed += 1;
      }
    }

    // Rule 22/24: 5-days-before alert, independent of message progress,
    // one campaign at a time so each generates its own alert.
    const remainingDays = daysBetween(today, campaign.end_date);
    if (remainingDays <= 5 && remainingDays >= 0) {
      const { data: existingNotification } = await admin
        .from("whatsapp_notifications")
        .select("id")
        .eq("campaign_id", campaign.id)
        .eq("notification_type", "cycle_ending_soon")
        .maybeSingle();

      if (!existingNotification) {
        const emailProvider = getEmailProvider();
        const recipientEmail = await findBenjaminGomezEmail();

        if (emailProvider && recipientEmail) {
          try {
            await emailProvider.send({
              to: recipientEmail,
              subject: "Quedan 5 días para finalizar los mensajes programados de WhatsApp",
              text: `El ciclo de mensajes programados está próximo a finalizar.\n\nCampaña: ${campaign.id}\nFecha de finalización: ${campaign.end_date}\n\nRevisá y agregá nuevos mensajes si querés mantener la programación activa.`,
            });
            await admin.from("whatsapp_notifications").insert({
              campaign_id: campaign.id,
              notification_type: "cycle_ending_soon",
              recipient_email: recipientEmail,
            });
            await admin.from("audit_log").insert({
              action: "whatsapp_cycle_alert_sent",
              resource_type: "whatsapp_campaign",
              resource_id: campaign.id,
              metadata: { recipient_email: recipientEmail },
            });
            summary.alertsSent += 1;
          } catch (err) {
            console.error("whatsapp cycle-ending alert failed to send", campaign.id, err);
          }
        }
      }
    }
  }

  return summary;
}
