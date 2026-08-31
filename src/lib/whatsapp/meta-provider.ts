import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { WhatsAppProvider, WhatsAppSendResult } from "./provider";

const GRAPH_VERSION = "v21.0";

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;
}

// Uploads the image (read from the private whatsapp-media bucket) to
// Meta's Media API and returns a media id — the officially supported way
// to attach media to a message (rule 19), rather than sending an
// externally-hosted URL Meta would have to fetch itself.
async function uploadMedia(imageStoragePath: string, token: string, phoneNumberId: string): Promise<string> {
  const admin = getSupabaseAdminClient();
  const { data: fileBlob, error } = await admin.storage.from("whatsapp-media").download(imageStoragePath);
  if (error || !fileBlob) {
    throw new Error(`Could not read ${imageStoragePath} from whatsapp-media: ${error?.message}`);
  }

  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", fileBlob.type || "image/jpeg");
  form.set("file", fileBlob, "image");

  const response = await fetch(graphUrl(`${phoneNumberId}/media`), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const body = (await response.json()) as { id?: string; error?: { message?: string } };
  if (!response.ok || !body.id) {
    throw new Error(body.error?.message ?? `Media upload failed (${response.status})`);
  }
  return body.id;
}

type MetaErrorBody = { error?: { code?: number; message?: string } };

export const metaCloudApiProvider: WhatsAppProvider = {
  name: "meta_cloud_api",
  async sendMessage({ to, text, imageStoragePath, templateName, templateLanguage }): Promise<WhatsAppSendResult> {
    const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) {
      return { ok: false, errorCode: "not_configured", errorMessage: "WhatsApp Cloud API env vars missing" };
    }

    let mediaId: string | null = null;
    if (imageStoragePath) {
      try {
        mediaId = await uploadMedia(imageStoragePath, token, phoneNumberId);
      } catch (err) {
        return {
          ok: false,
          errorCode: "media_upload_failed",
          errorMessage: err instanceof Error ? err.message : "Unknown media upload error",
        };
      }
    }

    // Outside a 24h customer-service session (the normal case for a
    // scheduled broadcast to a cold list), Meta rejects anything but an
    // approved Message Template — see the comment on
    // whatsapp_template_name in the migration and in README.
    const payload = templateName
      ? {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLanguage },
            components: [
              ...(mediaId
                ? [{ type: "header", parameters: [{ type: "image", image: { id: mediaId } }] }]
                : []),
              { type: "body", parameters: [{ type: "text", text }] },
            ],
          },
        }
      : mediaId
        ? { messaging_product: "whatsapp", to, type: "image", image: { id: mediaId, caption: text } }
        : { messaging_product: "whatsapp", to, type: "text", text: { body: text } };

    const response = await fetch(graphUrl(`${phoneNumberId}/messages`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as MetaErrorBody & { messages?: { id: string }[] };
    if (!response.ok || !body.messages?.[0]?.id) {
      return {
        ok: false,
        errorCode: String(body.error?.code ?? response.status),
        errorMessage: body.error?.message ?? `WhatsApp send failed (${response.status})`,
      };
    }

    return { ok: true, externalId: body.messages[0].id };
  },
};
