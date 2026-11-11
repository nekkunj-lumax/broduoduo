"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Minus, PackageX, Plus, ShieldCheck, Star, Truck, Users } from "lucide-react";
import { toast } from "sonner";
import { groupsApi, productsApi } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { cn, formatMoney, savingsPercent, toNumber } from "@/lib/utils";
import { ProductImage } from "@/components/ProductImage";
import { GroupCard } from "@/components/GroupCard";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const cart = useCart();

  const [imageIdx, setImageIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [groupSize, setGroupSize] = useState<number | null>(null);

  const product = useQuery({ queryKey: ["product", id], queryFn: () => productsApi.get(id), enabled: !!id });
  const groups = useQuery({
    queryKey: ["groups", "product", id],
    queryFn: () => groupsApi.list({ product_id: id, page_size: 6 }),
    enabled: !!id,
  });

  if (product.isLoading) {
    return (
      <div className="grid gap-8 md:grid-cols-2">
        <Skeleton className="aspect-square" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (product.isError || !product.data) {
    const notFound = isAxiosError(product.error) && product.error.response?.status === 404;
    return notFound ? (
      <EmptyState icon={PackageX} title="Product not found" description="It may have been removed." actionHref="/products" actionLabel="Browse products" />
    ) : (
      <ErrorState message="We couldn't load this product." onRetry={() => product.refetch()} />
    );
  }

  const p = product.data;
  const images = p.images.length ? [...p.images].sort((a, b) => a.sort_order - b.sort_order) : [];
  const currentImage = images[imageIdx]?.url ?? p.primary_image_url;
  const off = savingsPercent(p.individual_price, p.group_price);
  const stock = p.inventory?.available_qty ?? p.available_qty ?? null;
  const soldOut = stock !== null && stock <= 0;
  const maxQty = Math.min(10, stock ?? 10);
  const size = groupSize ?? p.group_size;
  const rating = toNumber(p.rating_avg);

  function addAndGo(mode: "group_create" | "individual") {
    cart.add({
      mode,
      product: p,
      quantity: qty,
      requiredParticipants: mode === "group_create" ? size : undefined,
    });
    toast.success(mode === "group_create" ? "Group added to your cart" : "Added to your cart");
    router.push("/cart");
  }

  return (
    <div className="space-y-12">
      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        {/* Gallery */}
        <div>
          <ProductImage src={currentImage} alt={p.name} className="aspect-square w-full rounded-3xl shadow-soft" />
          {images.length > 1 && (
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setImageIdx(i)}
                  aria-label={`Show image ${i + 1}`}
                  className={cn(
                    "h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition",
                    i === imageIdx ? "border-brand-500" : "border-transparent opacity-70 hover:opacity-100",
                  )}
                >
                  <ProductImage src={img.url} alt={img.alt_text ?? p.name} className="h-full w-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-500">Sold by {p.seller_name}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold leading-tight text-ink-800 sm:text-4xl">{p.name}</h1>
          <p className="mt-2 text-ink-500">{p.short_description}</p>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-ink-500">
            {p.rating_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {rating.toFixed(1)} ({p.rating_count} reviews)
              </span>
            )}
            <span>{p.units_sold} sold</span>
            {p.successful_groups_count > 0 && <span>{p.successful_groups_count} successful groups</span>}
          </div>

          {/* Pricing */}
          <div className="card mt-5 p-5">
            {p.is_group_buy_enabled ? (
              <>
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-display text-4xl font-semibold text-brand-600">
                    {formatMoney(p.group_price, p.currency)}
                  </span>
                  <span className="text-lg text-ink-400 line-through">{formatMoney(p.individual_price, p.currency)}</span>
                  {off > 0 && (
                    <span className="rounded-full bg-brand-500 px-2.5 py-1 text-xs font-bold text-white">Save {off}%</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink-500">
                  Group price when {size} people buy together within {p.group_expiration_hours}h.
                </p>
              </>
            ) : (
              <span className="font-display text-4xl font-semibold text-ink-800">
                {formatMoney(p.individual_price, p.currency)}
              </span>
            )}
          </div>

          {/* Options */}
          <div className="mt-5 flex flex-wrap items-end gap-6">
            <div>
              <span className="label">Quantity</span>
              <div className="inline-flex items-center rounded-full border border-brand-100 bg-white">
                <button type="button" aria-label="Decrease quantity" className="p-2.5 disabled:opacity-40" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)}>
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{qty}</span>
                <button type="button" aria-label="Increase quantity" className="p-2.5 disabled:opacity-40" disabled={qty >= maxQty} onClick={() => setQty((q) => q + 1)}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {p.is_group_buy_enabled && p.max_group_size > 2 && (
              <div>
                <label htmlFor="group-size" className="label">Group size</label>
                <select id="group-size" className="input !w-auto !py-2.5" value={size} onChange={(e) => setGroupSize(Number(e.target.value))}>
                  {Array.from({ length: p.max_group_size - 1 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>{n} people</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {p.is_group_buy_enabled && (
              <button type="button" disabled={soldOut} onClick={() => addAndGo("group_create")} className="btn-primary btn-lg flex-1">
                <Users className="h-5 w-5" /> Start a group · {formatMoney(toNumber(p.group_price) * qty, p.currency)}
              </button>
            )}
            <button
              type="button"
              disabled={soldOut}
              onClick={() => addAndGo("individual")}
              className={cn(p.is_group_buy_enabled ? "btn-secondary btn-lg" : "btn-primary btn-lg flex-1")}
            >
              Buy solo · {formatMoney(toNumber(p.individual_price) * qty, p.currency)}
            </button>
          </div>
          {soldOut && <p className="mt-2 text-sm font-medium text-red-600">Currently out of stock.</p>}
          {!soldOut && p.inventory?.is_low_stock && (
            <p className="mt-2 text-sm font-medium text-amber-600">Only {stock} left in stock.</p>
          )}

          <ul className="mt-6 space-y-2.5 text-sm text-ink-600">
            <li className="flex items-center gap-2.5"><Truck className="h-4 w-4 text-brand-500" /> {p.shipping_info}</li>
            <li className="flex items-center gap-2.5"><ShieldCheck className="h-4 w-4 text-brand-500" /> Refunded automatically if your group doesn&apos;t fill in time</li>
          </ul>
        </div>
      </div>

      {/* Open groups */}
      {p.is_group_buy_enabled && (
        <section>
          <h2 className="mb-1 font-display text-2xl font-semibold text-ink-800">Join a group for this product</h2>
          <p className="mb-4 text-sm text-ink-500">Jump into an existing group and get the group price faster.</p>
          {groups.isLoading ? (
            <Skeleton className="h-36" />
          ) : groups.data && groups.data.items.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {groups.data.items.map((g) => <GroupCard key={g.id} group={g} />)}
            </div>
          ) : (
            <div className="card px-6 py-8 text-center text-sm text-ink-500">
              No open groups for this product yet. Be the first to start one!
            </div>
          )}
        </section>
      )}

      {/* Description */}
      <section className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-2xl font-semibold text-ink-800">About this product</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{p.description}</p>
        </div>
        {p.specifications && (
          <div>
            <h2 className="mb-3 font-display text-2xl font-semibold text-ink-800">Specifications</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{p.specifications}</p>
          </div>
        )}
      </section>

      <div>
        <Link href="/products" className="text-sm font-semibold text-brand-600 hover:underline">← Back to all products</Link>
      </div>
    </div>
  );
}
