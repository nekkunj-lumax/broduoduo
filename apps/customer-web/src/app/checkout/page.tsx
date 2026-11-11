"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Lock, MapPin, Plus, ShoppingCart, XCircle } from "lucide-react";
import { toast } from "sonner";
import { customerApi, getErrorMessage, groupsApi, ordersApi, paymentsApi } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { lineUnitPrice, useCart, type CartItem } from "@/lib/cart";
import { cn, formatMoney, newIdempotencyKey } from "@/lib/utils";
import { AddressForm } from "@/components/AddressForm";
import { EmptyState, ErrorState, Skeleton, Spinner } from "@/components/States";

type LineState = { status: "idle" | "working" | "done" | "error"; message?: string };

export default function CheckoutPage() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const cart = useCart();

  const [addressId, setAddressId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const finished = useRef(false);

  const addresses = useQuery({
    queryKey: ["addresses"],
    queryFn: customerApi.addresses,
    enabled: !!user,
  });

  useEffect(() => {
    if (!addresses.data || addressId) return;
    const def = addresses.data.find((a) => a.is_default) ?? addresses.data[0];
    if (def) setAddressId(def.id);
  }, [addresses.data, addressId]);

  if (loading || !user || !cart.hydrated) return <Skeleton className="h-96" />;

  if (cart.items.length === 0 && !finished.current) {
    return (
      <EmptyState icon={ShoppingCart} title="Nothing to check out" description="Your cart is empty." actionHref="/products" actionLabel="Browse products" />
    );
  }

  const items = cart.items;
  const currency = items[0]?.currency ?? "USD";
  const total = items.reduce((s, i) => s + lineUnitPrice(i) * i.quantity, 0);
  const setLine = (key: string, state: LineState) => setLines((l) => ({ ...l, [key]: state }));

  /** Create the order (idempotent per cart line) and pay for it. */
  async function processItem(item: CartItem, address: string): Promise<string | undefined> {
    let orderId = item.orderId;
    let groupId = item.groupId;

    if (!orderId) {
      if (item.mode === "individual") {
        const order = await ordersApi.create({
          product_id: item.productId,
          quantity: item.quantity,
          address_id: address,
          idempotency_key: item.orderKey,
        });
        orderId = order.id;
      } else if (item.mode === "group_create") {
        const res = await groupsApi.create({
          product_id: item.productId,
          quantity: item.quantity,
          address_id: address,
          required_participants: item.requiredParticipants,
          idempotency_key: item.orderKey,
        });
        orderId = res.order.id;
        groupId = res.group.id;
      } else {
        const res = await groupsApi.join(item.groupId!, {
          quantity: item.quantity,
          address_id: address,
          invite_token: item.inviteCode,
          idempotency_key: item.orderKey,
        });
        orderId = res.order.id;
      }
      cart.patch(item.key, { orderId, groupId });
    }

    await paymentsApi.create({ order_id: orderId, idempotency_key: newIdempotencyKey("pay") });
    return groupId;
  }

  async function placeOrder() {
    if (!addressId) {
      toast.error("Choose a delivery address first");
      return;
    }
    setPlacing(true);
    let succeeded = 0;
    let failed = 0;
    let lastGroupId: string | null = null;

    for (const item of [...items]) {
      setLine(item.key, { status: "working" });
      try {
        const groupId = await processItem(item, addressId);
        setLine(item.key, { status: "done" });
        cart.remove(item.key);
        succeeded++;
        if (item.mode !== "individual") lastGroupId = groupId ?? lastGroupId;
      } catch (e) {
        failed++;
        setLine(item.key, { status: "error", message: getErrorMessage(e) });
      }
    }

    setPlacing(false);
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["customer-groups"] });
    qc.invalidateQueries({ queryKey: ["groups"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });

    if (failed === 0) {
      finished.current = true;
      toast.success(succeeded > 1 ? "All orders paid!" : "Payment successful!");
      router.push(lastGroupId ? `/groups/${lastGroupId}` : "/account/orders");
    } else if (succeeded > 0) {
      toast.warning(`${succeeded} paid, ${failed} need attention`);
    } else {
      toast.error("We couldn't complete your payment");
    }
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-semibold text-ink-800 sm:text-4xl">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {/* Address */}
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink-800">
                <MapPin className="h-5 w-5 text-brand-500" /> Delivery address
              </h2>
              {!addingAddress && (addresses.data?.length ?? 0) > 0 && (
                <button type="button" onClick={() => setAddingAddress(true)} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
                  <Plus className="h-4 w-4" /> New
                </button>
              )}
            </div>

            {addresses.isLoading ? (
              <Skeleton className="h-24" />
            ) : addresses.isError ? (
              <ErrorState message="We couldn't load your addresses." onRetry={() => addresses.refetch()} />
            ) : addingAddress || addresses.data!.length === 0 ? (
              <>
                {addresses.data!.length === 0 && <p className="mb-4 text-sm text-ink-500">Add an address so we know where to deliver.</p>}
                <AddressForm
                  onCreated={(a) => {
                    setAddressId(a.id);
                    setAddingAddress(false);
                  }}
                  onCancel={addresses.data!.length > 0 ? () => setAddingAddress(false) : undefined}
                />
              </>
            ) : (
              <div role="radiogroup" aria-label="Delivery address" className="grid gap-3 sm:grid-cols-2">
                {addresses.data!.map((a) => (
                  <label
                    key={a.id}
                    className={cn(
                      "cursor-pointer rounded-2xl border-2 p-4 text-sm transition",
                      addressId === a.id ? "border-brand-500 bg-brand-50/60" : "border-brand-100 bg-white hover:border-brand-300",
                    )}
                  >
                    <input type="radio" name="address" className="sr-only" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                    <p className="flex items-center gap-2 font-semibold text-ink-800">
                      {a.label}
                      {a.is_default && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700">Default</span>}
                    </p>
                    <p className="mt-1 text-ink-600">{a.recipient_name}</p>
                    <p className="text-ink-500">
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}
                    </p>
                    <p className="text-ink-500">
                      {a.city}, {a.state} {a.postal_code}, {a.country}
                    </p>
                    <p className="text-ink-500">{a.phone}</p>
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* Items */}
          <section className="card p-5">
            <h2 className="mb-4 font-display text-xl font-semibold text-ink-800">Review items</h2>
            <ul className="divide-y divide-brand-100">
              {items.map((item) => {
                const st = lines[item.key];
                return (
                  <li key={item.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-800">{item.name}</p>
                      <p className="text-xs text-ink-500">
                        {item.mode === "individual" ? "Solo" : item.mode === "group_create" ? "Start group" : "Join group"} · Qty {item.quantity}
                      </p>
                      {st?.status === "error" && (
                        <p className="mt-1 flex items-start gap-1 text-xs font-medium text-red-600">
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {st.message}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {st?.status === "working" && <Spinner className="h-4 w-4" />}
                      {st?.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                      <span className="text-sm font-semibold text-ink-800">{formatMoney(lineUnitPrice(item) * item.quantity, item.currency)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:col-span-2">
          <div className="card sticky top-24 space-y-4 p-5">
            <h2 className="font-display text-xl font-semibold text-ink-800">Order summary</h2>
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Items</span>
              <span className="font-semibold">{formatMoney(total, currency)}</span>
            </div>
            <p className="text-xs text-ink-500">Shipping and tax are calculated by the server when your order is created.</p>
            <div className="flex justify-between border-t border-brand-100 pt-4">
              <span className="font-semibold text-ink-800">Estimated total</span>
              <span className="font-display text-2xl font-semibold text-brand-600">{formatMoney(total, currency)}</span>
            </div>

            <button
              type="button"
              onClick={placeOrder}
              disabled={placing || !addressId || addingAddress}
              className="btn-primary btn-lg w-full"
            >
              {placing ? <Spinner className="h-5 w-5 text-white" /> : <Lock className="h-4 w-4" />}
              {placing ? "Processing…" : `Pay ${formatMoney(total, currency)}`}
            </button>
            <p className="text-center text-xs text-ink-500">
              Payments are processed securely by Brodoudou&apos;s payment provider. If a group doesn&apos;t fill in time, you&apos;re refunded.
            </p>
            <Link href="/cart" className="btn-ghost w-full">
              Back to cart
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
