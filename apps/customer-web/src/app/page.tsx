"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Flame, Search, Share2, Sparkles, Users, Wallet } from "lucide-react";
import { groupsApi, productsApi } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { GroupCard } from "@/components/GroupCard";
import { ErrorState, ProductGridSkeleton, Skeleton } from "@/components/States";

function SectionHeader({ title, href, eyebrow }: { title: string; href: string; eyebrow?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <div>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-widest text-brand-500">{eyebrow}</p>}
        <h2 className="font-display text-2xl font-semibold text-ink-800 sm:text-3xl">{title}</h2>
      </div>
      <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
        See all <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const categories = useQuery({ queryKey: ["categories"], queryFn: productsApi.categories, staleTime: 5 * 60_000 });
  const featured = useQuery({
    queryKey: ["products", "featured"],
    queryFn: () => productsApi.list({ featured: true, page_size: 8 }),
  });
  const trending = useQuery({
    queryKey: ["products", "popular"],
    queryFn: () => productsApi.list({ sort: "popular", page_size: 8 }),
  });
  const groups = useQuery({ queryKey: ["groups", "home"], queryFn: () => groupsApi.list({ page_size: 4 }) });

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/products?q=${encodeURIComponent(term)}` : "/products");
  }

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-400 via-brand-500 to-brand-600 px-6 py-10 text-white shadow-glow sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-amber-200/20 blur-3xl" />
        <div className="relative max-w-2xl animate-fade-up">
          <p className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Brodoudou</p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Group buying, made social
          </span>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
            Better prices when you shop <em className="font-medium italic">together</em>.
          </h1>
          <p className="mt-4 max-w-lg text-base text-white/90 sm:text-lg">
            Start a group, share the link, and unlock the group price once your friends join. Not enough? You get refunded.
          </p>

          <form onSubmit={onSearch} className="mt-7 flex max-w-lg gap-2 rounded-full bg-white p-1.5 shadow-soft" role="search">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="What are you looking for?"
                aria-label="Search products"
                className="w-full rounded-full bg-transparent py-3 pl-11 pr-3 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none"
              />
            </div>
            <button type="submit" className="btn-primary">
              Search
            </button>
          </form>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/groups" className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/30">
              <Users className="h-4 w-4" /> Browse open groups
            </Link>
            <Link href="/products" className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold hover:bg-white/15">
              Shop all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      {(categories.data?.length ?? 0) > 0 && (
        <section aria-label="Categories">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {categories.data!.map((c) => (
              <Link key={c.id} href={`/products?category_id=${c.id}`} className="chip shrink-0">
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Almost full groups */}
      <section>
        <SectionHeader eyebrow="Happening now" title="Groups you can join" href="/groups" />
        {groups.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-36" />)}
          </div>
        ) : groups.isError ? (
          <ErrorState message="We couldn't load open groups." onRetry={() => groups.refetch()} />
        ) : groups.data!.items.length === 0 ? (
          <div className="card px-6 py-8 text-center text-sm text-ink-500">
            No open groups right now.{" "}
            <Link href="/products" className="font-semibold text-brand-600 hover:underline">
              Pick a product and start one!
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.data!.items.map((g) => <GroupCard key={g.id} group={g} />)}
          </div>
        )}
      </section>

      {/* Featured */}
      <section>
        <SectionHeader eyebrow="Hand-picked" title="Featured deals" href="/products?featured=true" />
        {featured.isLoading ? (
          <ProductGridSkeleton count={4} />
        ) : featured.isError ? (
          <ErrorState message="We couldn't load featured products." onRetry={() => featured.refetch()} />
        ) : featured.data!.items.length === 0 ? (
          <p className="text-sm text-ink-500">No featured products yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {featured.data!.items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="card px-6 py-10 sm:px-10">
        <h2 className="text-center font-display text-2xl font-semibold text-ink-800 sm:text-3xl">How Brodoudou works</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {[
            { icon: Wallet, title: "1. Pick & pay", text: "Choose a product and start a group (or join one) at the group price." },
            { icon: Share2, title: "2. Share the link", text: "Invite friends. Each person who pays fills a spot in the group." },
            { icon: Users, title: "3. Group fills, order ships", text: "When the group is full, everyone's order moves forward. If time runs out, you're refunded." },
          ].map((s) => (
            <div key={s.title} className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
                <s.icon className="h-7 w-7" />
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold text-ink-800">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-500">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trending */}
      <section>
        <SectionHeader eyebrow="Popular" title="Trending now" href="/products?sort=popular" />
        {trending.isLoading ? (
          <ProductGridSkeleton count={4} />
        ) : trending.isError ? (
          <ErrorState message="We couldn't load trending products." onRetry={() => trending.refetch()} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {trending.data!.items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
        <div className="mt-6 flex justify-center">
          <Link href="/products" className="btn-secondary">
            <Flame className="h-4 w-4" /> Explore all products
          </Link>
        </div>
      </section>
    </div>
  );
}
