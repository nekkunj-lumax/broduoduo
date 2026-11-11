"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { toNumber, newIdempotencyKey } from "@/lib/utils";
import type { ProductListItem } from "@/lib/api";

/**
 * The backend has no server-side cart, so the cart lives in localStorage.
 * Each line becomes a real API call at checkout:
 *  - individual   -> POST /api/orders
 *  - group_create -> POST /api/groups
 *  - group_join   -> POST /api/groups/{id}/join
 * then POST /api/payments/create for the resulting order.
 */
export type PurchaseMode = "individual" | "group_create" | "group_join";

export interface CartItem {
  key: string;
  mode: PurchaseMode;
  productId: string;
  name: string;
  image?: string | null;
  currency: string;
  individualPrice: number;
  groupPrice: number;
  quantity: number;
  groupSize: number;
  requiredParticipants?: number;
  groupId?: string;
  inviteCode?: string;
  /** Set once the order exists server-side so retries only re-attempt payment. */
  orderId?: string;
  /** Stable idempotency key for creating the order. */
  orderKey: string;
}

export interface AddToCartInput {
  mode: PurchaseMode;
  product: Pick<
    ProductListItem,
    "id" | "name" | "currency" | "individual_price" | "group_price" | "group_size" | "primary_image_url"
  >;
  quantity?: number;
  requiredParticipants?: number;
  groupId?: string;
  inviteCode?: string;
}

const STORAGE_KEY = "pindodo.cart.v1";

type Action =
  | { type: "hydrate"; items: CartItem[] }
  | { type: "add"; item: CartItem }
  | { type: "remove"; key: string }
  | { type: "qty"; key: string; quantity: number }
  | { type: "patch"; key: string; patch: Partial<CartItem> }
  | { type: "clear" };

function reducer(state: CartItem[], action: Action): CartItem[] {
  switch (action.type) {
    case "hydrate":
      return action.items;
    case "add": {
      const existing = state.find((i) => i.key === action.item.key);
      if (existing) {
        return state.map((i) =>
          i.key === action.item.key
            ? { ...i, quantity: Math.min(10, i.quantity + action.item.quantity) }
            : i,
        );
      }
      return [...state, action.item];
    }
    case "remove":
      return state.filter((i) => i.key !== action.key);
    case "qty":
      return state.map((i) => (i.key === action.key ? { ...i, quantity: Math.max(1, Math.min(10, action.quantity)) } : i));
    case "patch":
      return state.map((i) => (i.key === action.key ? { ...i, ...action.patch } : i));
    case "clear":
      return [];
  }
}

export function lineUnitPrice(item: CartItem): number {
  return item.mode === "individual" ? item.individualPrice : item.groupPrice;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  hydrated: boolean;
  add: (input: AddToCartInput) => void;
  remove: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  patch: (key: string, patch: Partial<CartItem>) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(reducer, []);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) dispatch({ type: "hydrate", items: parsed });
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const add = useCallback((input: AddToCartInput) => {
    const { product, mode } = input;
    const key = `${mode}:${product.id}:${input.groupId ?? ""}`;
    dispatch({
      type: "add",
      item: {
        key,
        mode,
        productId: product.id,
        name: product.name,
        image: product.primary_image_url,
        currency: product.currency,
        individualPrice: toNumber(product.individual_price),
        groupPrice: toNumber(product.group_price),
        quantity: input.quantity ?? 1,
        groupSize: product.group_size,
        requiredParticipants: input.requiredParticipants,
        groupId: input.groupId,
        inviteCode: input.inviteCode,
        orderKey: newIdempotencyKey("order"),
      },
    });
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((sum, i) => sum + lineUnitPrice(i) * i.quantity, 0),
      hydrated,
      add,
      remove: (key) => dispatch({ type: "remove", key }),
      setQuantity: (key, quantity) => dispatch({ type: "qty", key, quantity }),
      patch: (key, patch) => dispatch({ type: "patch", key, patch }),
      clear: () => dispatch({ type: "clear" }),
    }),
    [items, hydrated, add],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
