import Link from "next/link";
import { Star, Users } from "lucide-react";
import type { ProductListItem } from "@/lib/api";
import { formatMoney, savingsPercent, toNumber } from "@/lib/utils";
import { ProductImage } from "@/components/ProductImage";

export function ProductCard({ product }: { product: ProductListItem }) {
  const off = savingsPercent(product.individual_price, product.group_price);
  const rating = toNumber(product.rating_avg);
  const soldOut = product.available_qty !== null && product.available_qty !== undefined && product.available_qty <= 0;

  return (
    <Link
      href={`/products/${product.id}`}
      className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-glow/30"
    >
      <div className="relative">
        <ProductImage
          src={product.primary_image_url}
          alt={product.name}
          className="aspect-square w-full"
          imgClassName="transition duration-500 group-hover:scale-105"
        />
        {off > 0 && product.is_group_buy_enabled && (
          <span className="absolute left-3 top-3 rounded-full bg-brand-500 px-2.5 py-1 text-xs font-bold text-white shadow-glow">
            -{off}% group
          </span>
        )}
        {soldOut && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-bold text-ink-700">
            Sold out
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5 sm:p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink-800 sm:text-base">{product.name}</h3>

        <div className="flex items-center gap-3 text-xs text-ink-500">
          {product.rating_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
              {rating.toFixed(1)} <span className="text-ink-400">({product.rating_count})</span>
            </span>
          )}
          {product.successful_groups_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" aria-hidden />
              {product.successful_groups_count} groups
            </span>
          )}
        </div>

        <div className="mt-auto pt-1">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl font-semibold text-brand-600">
              {formatMoney(product.group_price, product.currency)}
            </span>
            {toNumber(product.individual_price) > toNumber(product.group_price) && (
              <span className="text-xs text-ink-400 line-through">
                {formatMoney(product.individual_price, product.currency)}
              </span>
            )}
          </div>
          {product.is_group_buy_enabled && (
            <p className="mt-0.5 text-xs font-medium text-ink-500">with {product.group_size} people</p>
          )}
        </div>
      </div>
    </Link>
  );
}
