import { describe, expect, it, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const rpcMock = vi.fn();
const isOnlinePaymentConfiguredMock = vi.fn();

vi.mock("@/lib/supabase/session", () => ({
  getSupabaseSessionClient: async () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
  }),
}));

vi.mock("@/lib/payments/provider", () => ({
  isOnlinePaymentConfigured: isOnlinePaymentConfiguredMock,
}));

const { createOrder } = await import("./checkout");

function buildFormData(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

const AUTH_USER = { id: "user-1", email: "buyer@example.com" };
const PRODUCT_ID = "123e4567-e89b-12d3-a456-426614174000";

const RPC_SUCCESS = {
  order_id: "order-123",
  reference: "RR-2026-000001",
  subtotal_cents: 1500,
  tax_cents: 0,
  total_cents: 1500,
  currency: "USD",
  payment_method: "bank_transfer",
};

describe("createOrder", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    rpcMock.mockReset();
    isOnlinePaymentConfiguredMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: AUTH_USER } });
    rpcMock.mockResolvedValue({ data: RPC_SUCCESS, error: null });
    isOnlinePaymentConfiguredMock.mockReturnValue(false);
  });

  it("CRITICAL: never sends a price to the server — only product id, modality, and quantity", async () => {
    const formData = buildFormData({
      items: JSON.stringify([{ productId: PRODUCT_ID, modality: "digital", quantity: 1 }]),
      first_name: "Test",
      last_name: "Buyer",
      billing_country: "AR",
      requiresShipping: "false",
    });

    await createOrder({ status: "idle" }, formData);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [fnName, args] = rpcMock.mock.calls[0];
    expect(fnName).toBe("create_order");
    expect(args.p_items).toEqual([{ product_id: PRODUCT_ID, modality: "digital", quantity: 1 }]);
    // The whole point: no price/currency field exists anywhere in the
    // payload for the server to (mis)trust. It always re-derives price
    // (and tax) from the database inside create_order().
    const payloadKeys = JSON.stringify(args.p_items);
    expect(payloadKeys).not.toMatch(/price/i);
  });

  it("even a client that appends extra fields (e.g. a forged price) can't smuggle them through — only known fields are forwarded", async () => {
    const formData = buildFormData({
      items: JSON.stringify([
        {
          productId: PRODUCT_ID,
          modality: "digital",
          quantity: 1,
          unit_price_cents: 1, // forged — should be ignored entirely
        },
      ]),
      first_name: "Test",
      last_name: "Buyer",
      billing_country: "AR",
      requiresShipping: "false",
    });

    await createOrder({ status: "idle" }, formData);

    const [, args] = rpcMock.mock.calls[0];
    expect(args.p_items[0]).toEqual({
      product_id: PRODUCT_ID,
      modality: "digital",
      quantity: 1,
    });
  });

  it("rejects when the user isn't authenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await createOrder(
      { status: "idle" },
      buildFormData({ items: "[]", first_name: "A", last_name: "B", billing_country: "AR", requiresShipping: "false" })
    );

    expect(result.status).toBe("error");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("requires a billing country", async () => {
    const result = await createOrder(
      { status: "idle" },
      buildFormData({
        items: JSON.stringify([{ productId: PRODUCT_ID, modality: "digital", quantity: 1 }]),
        first_name: "Test",
        last_name: "Buyer",
        requiresShipping: "false",
        // no billing_country provided
      })
    );

    expect(result.status).toBe("error");
    expect(result.errorKey).toBe("required");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("requires a shipping address when the cart requires shipping", async () => {
    const result = await createOrder(
      { status: "idle" },
      buildFormData({
        items: JSON.stringify([{ productId: PRODUCT_ID, modality: "fisico", quantity: 1 }]),
        first_name: "Test",
        last_name: "Buyer",
        billing_country: "AR",
        requiresShipping: "true",
        // no address fields provided
      })
    );

    expect(result.status).toBe("error");
    expect(result.errorKey).toBe("required");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("surfaces an out-of-stock error from the database function", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "Product test-book is out of stock" } });

    const result = await createOrder(
      { status: "idle" },
      buildFormData({
        items: JSON.stringify([{ productId: PRODUCT_ID, modality: "digital", quantity: 1 }]),
        first_name: "Test",
        last_name: "Buyer",
        billing_country: "AR",
        requiresShipping: "false",
      })
    );

    expect(result.status).toBe("error");
    expect(result.errorKey).toBe("outOfStock");
  });

  it("returns the full order breakdown on success", async () => {
    const result = await createOrder(
      { status: "idle" },
      buildFormData({
        items: JSON.stringify([{ productId: PRODUCT_ID, modality: "digital", quantity: 1 }]),
        first_name: "Test",
        last_name: "Buyer",
        billing_country: "AR",
        requiresShipping: "false",
      })
    );

    expect(result).toEqual({
      status: "success",
      orderId: "order-123",
      reference: "RR-2026-000001",
      subtotalCents: 1500,
      taxCents: 0,
      totalCents: 1500,
      currency: "USD",
      paymentMethod: "bank_transfer",
    });
  });

  it("defaults to bank_transfer when no payment method is chosen", async () => {
    await createOrder(
      { status: "idle" },
      buildFormData({
        items: JSON.stringify([{ productId: PRODUCT_ID, modality: "digital", quantity: 1 }]),
        first_name: "Test",
        last_name: "Buyer",
        billing_country: "AR",
        requiresShipping: "false",
      })
    );

    const [, args] = rpcMock.mock.calls[0];
    expect(args.p_payment_method).toBe("bank_transfer");
  });

  it("CRITICAL: rejects 'online' as a payment method when no provider is configured, even if the client requests it", async () => {
    isOnlinePaymentConfiguredMock.mockReturnValue(false);

    const result = await createOrder(
      { status: "idle" },
      buildFormData({
        items: JSON.stringify([{ productId: PRODUCT_ID, modality: "digital", quantity: 1 }]),
        first_name: "Test",
        last_name: "Buyer",
        billing_country: "AR",
        requiresShipping: "false",
        payment_method: "online",
      })
    );

    expect(result).toEqual({ status: "error", errorKey: "notAvailable" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("allows 'online' once a provider is configured", async () => {
    isOnlinePaymentConfiguredMock.mockReturnValue(true);

    await createOrder(
      { status: "idle" },
      buildFormData({
        items: JSON.stringify([{ productId: PRODUCT_ID, modality: "digital", quantity: 1 }]),
        first_name: "Test",
        last_name: "Buyer",
        billing_country: "AR",
        requiresShipping: "false",
        payment_method: "online",
      })
    );

    const [, args] = rpcMock.mock.calls[0];
    expect(args.p_payment_method).toBe("online");
  });

  it("passes the billing country through to the server for tax calculation", async () => {
    await createOrder(
      { status: "idle" },
      buildFormData({
        items: JSON.stringify([{ productId: PRODUCT_ID, modality: "digital", quantity: 1 }]),
        first_name: "Test",
        last_name: "Buyer",
        billing_country: "US",
        requiresShipping: "false",
      })
    );

    const [, args] = rpcMock.mock.calls[0];
    expect(args.p_billing_country).toBe("US");
  });
});
