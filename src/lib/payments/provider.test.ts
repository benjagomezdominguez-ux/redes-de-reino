import { describe, expect, it, afterEach } from "vitest";
import { isOnlinePaymentConfigured, getPaymentProvider } from "./provider";

const originalEnv = process.env.PAYMENT_PROVIDER;

describe("payment provider configuration", () => {
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = originalEnv;
  });

  it("CRITICAL: reports unconfigured when no PAYMENT_PROVIDER env var is set — this project has none today", () => {
    delete process.env.PAYMENT_PROVIDER;
    expect(isOnlinePaymentConfigured()).toBe(false);
    expect(getPaymentProvider()).toBeNull();
  });

  it("would report configured if a provider name were set (still returns no implementation, since none is registered yet)", () => {
    process.env.PAYMENT_PROVIDER = "mercadopago";
    expect(isOnlinePaymentConfigured()).toBe(true);
    // No real provider is wired in below getPaymentProvider() yet — this
    // is intentional (rule 51: never invent an integration).
    expect(getPaymentProvider()).toBeNull();
  });
});
