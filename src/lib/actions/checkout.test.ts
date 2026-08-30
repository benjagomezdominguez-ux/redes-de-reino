import { describe, expect, it, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabase/session", () => ({
  getSupabaseSessionClient: async () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
  }),
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

describe("createOrder", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    rpcMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: AUTH_USER } });
    rpcMock.mockResolvedValue({ data: "order-123", error: null });
  });

  it("CRITICAL: never sends a price to the server — only product id, modality, and quantity", async () => {
    const formData = buildFormData({
      items: JSON.stringify([
        { productId: "123e4567-e89b-12d3-a456-426614174000", modality: "digital", quantity: 1 },
      ]),
      first_name: "Test",
      last_name: "Buyer",
      requiresShipping: "false",
    });

    await createOrder({ status: "idle" }, formData);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [fnName, args] = rpcMock.mock.calls[0];
    expect(fnName).toBe("create_order");
    expect(args.p_items).toEqual([
      { product_id: "123e4567-e89b-12d3-a456-426614174000", modality: "digital", quantity: 1 },
    ]);
    // The whole point: no price/currency field exists anywhere in the
    // payload for the server to (mis)trust. It always re-derives price
    // from the products table inside create_order().
    const payloadKeys = JSON.stringify(args);
    expect(payloadKeys).not.toMatch(/price/i);
  });

  it("even a client that appends extra fields (e.g. a forged price) can't smuggle them through — only known fields are forwarded", async () => {
    const formData = buildFormData({
      // Simulates a tampered client sending extra data alongside a valid item.
      items: JSON.stringify([
        {
          productId: "123e4567-e89b-12d3-a456-426614174000",
          modality: "digital",
          quantity: 1,
          unit_price_cents: 1, // forged — should be ignored entirely
        },
      ]),
      first_name: "Test",
      last_name: "Buyer",
      requiresShipping: "false",
    });

    await createOrder({ status: "idle" }, formData);

    const [, args] = rpcMock.mock.calls[0];
    expect(args.p_items[0]).toEqual({
      product_id: "123e4567-e89b-12d3-a456-426614174000",
      modality: "digital",
      quantity: 1,
    });
  });

  it("rejects when the user isn't authenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await createOrder(
      { status: "idle" },
      buildFormData({ items: "[]", first_name: "A", last_name: "B", requiresShipping: "false" })
    );

    expect(result.status).toBe("error");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("requires a shipping address when the cart requires shipping", async () => {
    const result = await createOrder(
      { status: "idle" },
      buildFormData({
        items: JSON.stringify([
          { productId: "123e4567-e89b-12d3-a456-426614174000", modality: "fisico", quantity: 1 },
        ]),
        first_name: "Test",
        last_name: "Buyer",
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
        items: JSON.stringify([
          { productId: "123e4567-e89b-12d3-a456-426614174000", modality: "digital", quantity: 1 },
        ]),
        first_name: "Test",
        last_name: "Buyer",
        requiresShipping: "false",
      })
    );

    expect(result.status).toBe("error");
    expect(result.errorKey).toBe("outOfStock");
  });

  it("returns the order id on success", async () => {
    const result = await createOrder(
      { status: "idle" },
      buildFormData({
        items: JSON.stringify([
          { productId: "123e4567-e89b-12d3-a456-426614174000", modality: "digital", quantity: 1 },
        ]),
        first_name: "Test",
        last_name: "Buyer",
        requiresShipping: "false",
      })
    );

    expect(result).toEqual({ status: "success", orderId: "order-123" });
  });
});
