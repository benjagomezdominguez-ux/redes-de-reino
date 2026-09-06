import { describe, expect, it, afterEach } from "vitest";
import { isWhatsAppConfigured, getWhatsAppProvider } from "./provider";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("isWhatsAppConfigured / getWhatsAppProvider", () => {
  it("CRITICAL: is false when none of the three required env vars are set — the real state today", () => {
    delete process.env.WHATSAPP_CLOUD_API_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    expect(isWhatsAppConfigured()).toBe(false);
    expect(getWhatsAppProvider()).toBeNull();
  });

  it("is false when only some of the three required env vars are set", () => {
    process.env.WHATSAPP_CLOUD_API_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    delete process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    expect(isWhatsAppConfigured()).toBe(false);
  });

  it("CRITICAL: is true only once all three required env vars are set, and returns the real Meta Cloud API provider", () => {
    process.env.WHATSAPP_CLOUD_API_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "456";
    expect(isWhatsAppConfigured()).toBe(true);
    expect(getWhatsAppProvider()?.name).toBe("meta_cloud_api");
  });
});
