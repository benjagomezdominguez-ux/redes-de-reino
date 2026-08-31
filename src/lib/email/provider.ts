import "server-only";
import { resendProvider } from "./resend-provider";

// No transactional-email provider is configured in this project today
// (no RESEND_API_KEY, no SendGrid, nothing) — same situation as
// src/lib/payments/provider.ts before a payment gateway is wired in, and
// handled the same way: a real interface the rest of the app depends on,
// with zero fake behavior when nothing is configured. resendProvider
// itself does nothing at import time — it only makes a real API call
// when EMAIL_PROVIDER=resend and RESEND_API_KEY are both set.

export type EmailProvider = {
  name: string;
  send(params: { to: string; subject: string; text: string }): Promise<{ externalId: string }>;
};

export function isEmailConfigured(): boolean {
  return process.env.EMAIL_PROVIDER === "resend" && Boolean(process.env.RESEND_API_KEY);
}

export function getEmailProvider(): EmailProvider | null {
  if (!isEmailConfigured()) return null;
  return resendProvider;
}
