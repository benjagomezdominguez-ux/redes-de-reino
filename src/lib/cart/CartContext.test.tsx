import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { CartProvider, useCart, type CartItem } from "./CartContext";

function wrapper({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: "book-1",
    modality: "digital",
    quantity: 1,
    title: "Test Book",
    author: "Test Author",
    coverUrl: null,
    unitPriceCents: 1000,
    currency: "USD",
    maxStock: null,
    ...overrides,
  };
}

describe("CartContext", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toEqual([]);
    expect(result.current.subtotalCents).toBe(0);
    expect(result.current.itemCount).toBe(0);
    expect(result.current.requiresShipping).toBe(false);
  });

  it("adds an item", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(makeItem()));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.subtotalCents).toBe(1000);
    expect(result.current.itemCount).toBe(1);
  });

  it("merges the same product+modality by summing quantity", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(makeItem({ quantity: 1 })));
    act(() => result.current.addItem(makeItem({ quantity: 2 })));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(3);
  });

  it("treats the same product with a different modality as a separate line", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(makeItem({ modality: "digital" })));
    act(() => result.current.addItem(makeItem({ modality: "fisico" })));
    expect(result.current.items).toHaveLength(2);
  });

  it("caps quantity at maxStock when adding", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(makeItem({ quantity: 3, maxStock: 5 })));
    act(() => result.current.addItem(makeItem({ quantity: 10, maxStock: 5 })));
    expect(result.current.items[0].quantity).toBe(5);
  });

  it("caps quantity at maxStock when setting directly, and never below 1", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(makeItem({ quantity: 1, maxStock: 3 })));
    act(() => result.current.setQuantity("book-1", "digital", 100));
    expect(result.current.items[0].quantity).toBe(3);
    act(() => result.current.setQuantity("book-1", "digital", -5));
    expect(result.current.items[0].quantity).toBe(1);
  });

  it("removes an item", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(makeItem()));
    act(() => result.current.removeItem("book-1", "digital"));
    expect(result.current.items).toEqual([]);
  });

  it("clears the cart", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(makeItem()));
    act(() => result.current.addItem(makeItem({ productId: "book-2" })));
    act(() => result.current.clear());
    expect(result.current.items).toEqual([]);
  });

  it("computes subtotal across multiple lines", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(makeItem({ productId: "book-1", unitPriceCents: 1000, quantity: 2 })));
    act(() => result.current.addItem(makeItem({ productId: "book-2", unitPriceCents: 500, quantity: 3 })));
    expect(result.current.subtotalCents).toBe(1000 * 2 + 500 * 3);
    expect(result.current.itemCount).toBe(5);
  });

  it("requires shipping only when a physical or digital+physical item is present", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(makeItem({ modality: "digital" })));
    expect(result.current.requiresShipping).toBe(false);
    act(() => result.current.addItem(makeItem({ productId: "book-2", modality: "digital_fisico" })));
    expect(result.current.requiresShipping).toBe(true);
  });

  it("persists to localStorage and rehydrates a new provider instance", async () => {
    const { result, unmount } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(makeItem()));
    // allow the persistence effect to flush
    await act(async () => {});
    unmount();

    const { result: result2 } = renderHook(() => useCart(), { wrapper });
    await act(async () => {});
    expect(result2.current.items).toHaveLength(1);
    expect(result2.current.items[0].productId).toBe("book-1");
  });

  it("throws when useCart is used outside a CartProvider", () => {
    expect(() => renderHook(() => useCart())).toThrow(/CartProvider/);
  });
});
