import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { WhatsAppProvider, WhatsAppSendResult } from "./provider";

// Meta deprecates each Graph API version ~2 years after release — pinned
// to the latest stable version at the time of writing (v26.0, July 2026)
// rather than an older one nearing its own end-of-support date, so this
// keeps working for as long as possible without needing a revisit. The
// endpoints used here (/media, /messages) have been stable across
// versions; bump this periodically as newer versions ship.
const GRAPH_VERSION = "v26.0";

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

export type WhatsAppConnectionStatus = "not_configured" | "invalid" | "ok";

export type WhatsAppConfigCheck = {
  tokenConfigured: boolean;
  phoneNumberIdConfigured: boolean;
  businessAccountIdConfigured: boolean;
  connectionStatus: WhatsAppConnectionStatus;
  // A short, real error message from Meta (e.g. "Invalid OAuth access
  // token") when connectionStatus is "invalid" — never the token itself,
  // never a raw response dump, just the same error.message field the
  // send path already surfaces.
  connectionError?: string;
};

// A live, read-only, side-effect-free check against Meta's own API — the
// only way to actually confirm the token/phone number id are valid
// (rather than merely present), for the admin dashboard's status panel.
// Skips the network call entirely when the env vars aren't even set, so
// this costs nothing in the current, real "not configured" state.
export async function checkWhatsAppConnection(): Promise<WhatsAppConfigCheck> {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  const base: Omit<WhatsAppConfigCheck, "connectionStatus" | "connectionError"> = {
    tokenConfigured: Boolean(token),
    phoneNumberIdConfigured: Boolean(phoneNumberId),
    businessAccountIdConfigured: Boolean(businessAccountId),
  };

  if (!token || !phoneNumberId || !businessAccountId) {
    return { ...base, connectionStatus: "not_configured" };
  }

  try {
    const response = await fetch(graphUrl(`${phoneNumberId}?fields=verified_name,display_phone_number`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await response.json()) as MetaErrorBody & { id?: string };

    if (!response.ok || !body.id) {
      return {
        ...base,
        connectionStatus: "invalid",
        connectionError: body.error?.message ?? `HTTP ${response.status}`,
      };
    }

    return { ...base, connectionStatus: "ok" };
  } catch {
    // A network-level failure (DNS, timeout, etc.) — never expose the
    // raw exception, which could include request internals.
    return { ...base, connectionStatus: "invalid", connectionError: "No se pudo conectar con Meta." };
  }
}

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
