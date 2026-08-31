import "server-only";
import { metaCloudApiProvider } from "./meta-provider";

// No official WhatsApp integration is configured in this project today
// (no WHATSAPP_CLOUD_API_TOKEN, no phone number id) — same pattern as
// src/lib/payments/provider.ts: a real interface the scheduler depends
// on, with zero fake/simulated sends when nothing is configured.
//
// The only officially supported mechanism for this — the WhatsApp
// Business Platform (Meta Cloud API) — is what metaCloudApiProvider
// implements for real (see meta-provider.ts). It does nothing at import
// time and only makes real API calls once the required env vars exist.

export type WhatsAppSendResult =
  | { ok: true; externalId: string }
  | { ok: false; errorCode: string; errorMessage: string };

export type WhatsAppProvider = {
  name: string;
  // `to` is E.164 (e.g. "+5491122334455"). `imageStoragePath`, when set,
  // is read from the whatsapp-media bucket and uploaded to Meta's Media
  // API to get a media id — the image bytes themselves are never sent
  // inline (rule 19). `templateName` set = an approved Message Template
  // send (required outside a 24h customer-service session — i.e.
  // required for essentially every scheduled broadcast send). Left
  // unset = a freeform text+image send, which only Meta will accept if
  // this contact messaged the business within the last 24h.
  sendMessage(params: {
    to: string;
    text: string;
    imageStoragePath: string | null;
    templateName: string | null;
    templateLanguage: string;
  }): Promise<WhatsAppSendResult>;
};

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_CLOUD_API_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
  );
}

export function getWhatsAppProvider(): WhatsAppProvider | null {
  if (!isWhatsAppConfigured()) return null;
  return metaCloudApiProvider;
}
