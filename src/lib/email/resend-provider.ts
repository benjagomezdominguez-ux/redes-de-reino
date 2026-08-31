import "server-only";
import type { EmailProvider } from "./provider";

// Real Resend HTTP call — no SDK needed, it's a single POST. Inert unless
// RESEND_API_KEY (and RESEND_FROM_EMAIL) are actually set; provider.ts
// never calls send() otherwise. Picked as the default choice because it
// needs no more than an API key and a verified sender — nothing about
// this project mandated Resend specifically, so swapping it for another
// provider means implementing this same EmailProvider interface once.
export const resendProvider: EmailProvider = {
  name: "resend",
  async send({ to, subject, text }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      throw new Error("RESEND_API_KEY or RESEND_FROM_EMAIL missing");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend send failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as { id: string };
    return { externalId: data.id };
  },
};
