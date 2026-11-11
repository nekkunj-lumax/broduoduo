"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2, Users } from "lucide-react";
import { lineUnitPrice, useCart, type CartItem } from "@/lib/cart";
import { formatMoney } from "@/lib/utils";
import { ProductImage } from "@/components/ProductImage";
import { EmptyState, Skeleton } from "@/components/States";

function modeLabel(item: CartItem): string {
  switch (item.mode) {
    case "group_create":
      return `New group of ${item.requiredParticipants ?? item.groupSize}`;
    case "group_join":
      return "Joining an existing group";
    default:
      return "Buying solo";
  }
}

export default function CartPage() {
  const { items, subtotal, hydrated, setQuantity, remove, clear } = useCart();

  if (!hydrated) return <Skeleton className="h-64" />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Your cart is empty"
        description="Find a deal and start a group, or join one that's already going."
        actionHref="/products"
        actionLabel="Start shopping"
      />
    );
  }

  const currency = items[0].currency;
  const mixedCurrency = items.some((i) => i.currency !== currency);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <h1 className="font-display text-3xl font-semibold text-ink-800 sm:text-4xl">Your cart</h1>
        <button type="button" onClick={clear} className="text-sm font-semibold text-ink-500 hover:text-red-600">
          Clear all
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <ul className="space-y-3 lg:col-span-2">
          {items.map((item) => (
            <li key={item.key} className="card flex gap-4 p-3.5 sm:p-4">
              <Link href={`/products/${item.productId}`} className="shrink-0">
                <ProductImage src={item.image} alt={item.name} className="h-24 w-24 rounded-2xl sm:h-28 sm:w-28" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/products/${item.productId}`} className="line-clamp-2 text-sm font-semibold text-ink-800 hover:text-brand-600 sm:text-base">
                      {item.name}
                    </Link>
                    <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                      {item.mode !== "individual" && <Users className="h-3 w-3" />}
                      {modeLabel(item)}
                    </p>
                    {item.orderId && (
                      <p className="mt-1 text-xs font-medium text-amber-600">Order created — payment still needed</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(item.key)}
                    aria-label={`Remove ${item.name}`}
                    className="rounded-full p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="inline-flex items-center rounded-full border border-brand-100 bg-white">
                    <button type="button" aria-label="Decrease quantity" disabled={item.quantity <= 1 || !!item.orderId} onClick={() => setQuantity(item.key, item.quantity - 1)} className="p-2 disabled:opacity-40">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                    <button type="button" aria-label="Increase quantity" disabled={item.quantity >= 10 || !!item.orderId} onClick={() => setQuantity(item.key, item.quantity + 1)} className="p-2 disabled:opacity-40">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="font-display text-lg font-semibold text-brand-600">
                    {formatMoney(lineUnitPrice(item) * item.quantity, item.currency)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="lg:col-span-1">
          <div className="card sticky top-24 space-y-4 p-5">
            <h2 className="font-display text-xl font-semibold text-ink-800">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Items ({items.reduce((n, i) => n + i.quantity, 0)})</dt>
                <dd className="font-semibold text-ink-800">{formatMoney(subtotal, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Shipping &amp; tax</dt>
                <dd className="text-ink-500">Calculated at checkout</dd>
              </div>
            </dl>
            <div className="flex justify-between border-t border-brand-100 pt-4">
              <span className="font-semibold text-ink-800">Estimated total</span>
              <span className="font-display text-2xl font-semibold text-brand-600">{formatMoney(subtotal, currency)}</span>
            </div>
            {mixedCurrency && <p className="text-xs text-amber-600">Items use different currencies; totals are approximate.</p>}
            <Link href="/checkout" className="btn-primary btn-lg w-full">
              Checkout
            </Link>
            <Link href="/products" className="btn-ghost w-full">
              Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
