"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartModality = "digital" | "fisico" | "digital_fisico";

export type CartItem = {
  productId: string;
  modality: CartModality;
  quantity: number;
  // Display-only snapshot — the real price/stock is always re-verified
  // server-side in create_order() before an order is ever created.
  title: string;
  author: string | null;
  coverUrl: string | null;
  unitPriceCents: number;
  currency: string;
  maxStock: number | null;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, modality: CartModality) => void;
  setQuantity: (productId: string, modality: CartModality, quantity: number) => void;
  clear: () => void;
  subtotalCents: number;
  requiresShipping: boolean;
  itemCount: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "redes-de-reino-cart";

function itemKey(productId: string, modality: CartModality) {
  return `${productId}:${modality}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // One-time hydration from localStorage on mount (can't read it during
    // the initial render — that also runs server-side, where there's no
    // window). This is a single, terminal read-and-set, not the
    // cascading-render pattern the set-state-in-effect rule targets.
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // Corrupt/blocked storage — start with an empty cart rather than crash.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full or blocked (private mode) — cart still works for
      // this tab via in-memory state, just won't persist.
    }
  }, [items, hydrated]);

  const addItem = useCallback((newItem: CartItem) => {
    setItems((current) => {
      const key = itemKey(newItem.productId, newItem.modality);
      const existing = current.find((i) => itemKey(i.productId, i.modality) === key);
      if (existing) {
        const cap = existing.maxStock ?? Infinity;
        return current.map((i) =>
          itemKey(i.productId, i.modality) === key
            ? { ...i, quantity: Math.min(i.quantity + newItem.quantity, cap) }
            : i
        );
      }
      return [...current, newItem];
    });
  }, []);

  const removeItem = useCallback((productId: string, modality: CartModality) => {
    const key = itemKey(productId, modality);
    setItems((current) => current.filter((i) => itemKey(i.productId, i.modality) !== key));
  }, []);

  const setQuantity = useCallback(
    (productId: string, modality: CartModality, quantity: number) => {
      const key = itemKey(productId, modality);
      setItems((current) =>
        current.map((i) => {
          if (itemKey(i.productId, i.modality) !== key) return i;
          const cap = i.maxStock ?? Infinity;
          return { ...i, quantity: Math.max(1, Math.min(quantity, cap)) };
        })
      );
    },
    []
  );

  const clear = useCallback(() => setItems([]), []);

  const subtotalCents = useMemo(
    () => items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0),
    [items]
  );
  const requiresShipping = useMemo(
    () => items.some((i) => i.modality === "fisico" || i.modality === "digital_fisico"),
    [items]
  );
  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const value = useMemo(
    () => ({ items, addItem, removeItem, setQuantity, clear, subtotalCents, requiresShipping, itemCount }),
    [items, addItem, removeItem, setQuantity, clear, subtotalCents, requiresShipping, itemCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
