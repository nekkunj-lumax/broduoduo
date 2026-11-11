"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { PackageSearch, Search, X } from "lucide-react";
import { productsApi, type ProductSort } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState, ErrorState, ProductGridSkeleton, Spinner } from "@/components/States";

const SORTS: { value: ProductSort; label: string }[] = [
  { value: "popular", label: "Popular" },
  { value: "newest", label: "Newest" },
  { value: "discount", label: "Biggest savings" },
  { value: "rating", label: "Top rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

const PAGE_SIZE = 12;

function ProductsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const q = params.get("q") ?? "";
  const categoryId = params.get("category_id") ?? "";
  const sort = (params.get("sort") as ProductSort) || "popular";
  const groupOnly = params.get("group_buy_only") === "true";
  const featured = params.get("featured") === "true";

  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);

  function update(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => (v ? sp.set(k, v) : sp.delete(k)));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const categories = useQuery({ queryKey: ["categories"], queryFn: productsApi.categories, staleTime: 5 * 60_000 });

  const products = useInfiniteQuery({
    queryKey: ["products", { q, categoryId, sort, groupOnly, featured }],
    queryFn: ({ pageParam }) =>
      productsApi.list({
        q: q || undefined,
        category_id: categoryId || undefined,
        sort,
        group_buy_only: groupOnly || undefined,
        featured: featured || undefined,
        page: pageParam,
        page_size: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
  });

  const items = products.data?.pages.flatMap((p) => p.items) ?? [];
  const total = products.data?.pages[0]?.total ?? 0;
  const activeCategory = categories.data?.find((c) => c.id === categoryId);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    update({ q: search.trim() || null });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-ink-800 sm:text-4xl">
          {q ? `Results for “${q}”` : activeCategory ? activeCategory.name : featured ? "Featured deals" : "All products"}
        </h1>
        {!products.isLoading && !products.isError && (
          <p className="mt-1 text-sm text-ink-500">
            {total} {total === 1 ? "product" : "products"}
          </p>
        )}
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <form onSubmit={onSearch} className="relative flex-1" role="search">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            className="input pl-10 pr-10"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                update({ q: null });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-400 hover:bg-brand-50"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
        <select
          aria-label="Sort products"
          value={sort}
          onChange={(e) => update({ sort: e.target.value === "popular" ? null : e.target.value })}
          className="input sm:w-56"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <button
          type="button"
          onClick={() => update({ category_id: null })}
          className={cn("chip shrink-0", !categoryId && "chip-active")}
        >
          All
        </button>
        {categories.data?.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => update({ category_id: c.id })}
            className={cn("chip shrink-0", categoryId === c.id && "chip-active")}
          >
            {c.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => update({ group_buy_only: groupOnly ? null : "true" })}
          aria-pressed={groupOnly}
          className={cn("chip shrink-0 border-dashed", groupOnly && "chip-active")}
        >
          Group deals only
        </button>
        {featured && (
          <button type="button" onClick={() => update({ featured: null })} className="chip chip-active shrink-0">
            Featured <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {products.isLoading ? (
        <ProductGridSkeleton count={8} />
      ) : products.isError ? (
        <ErrorState message="We couldn't load products." onRetry={() => products.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No products found"
          description="Try a different search or clear your filters."
          actionHref="/products"
          actionLabel="Clear filters"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {products.hasNextPage && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                className="btn-secondary"
                disabled={products.isFetchingNextPage}
                onClick={() => products.fetchNextPage()}
              >
                {products.isFetchingNextPage && <Spinner className="h-4 w-4" />} Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <ProductsContent />
    </Suspense>
  );
}
