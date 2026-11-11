"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell, Home, LogOut, Package, Search, ShoppingBag, ShoppingCart, User as UserIcon, Users } from "lucide-react";
import { toast } from "sonner";
import { customerApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { cn, initials } from "@/lib/utils";
import { Logo } from "@/components/Logo";

const NAV_LINKS = [
  { href: "/products", label: "Shop" },
  { href: "/groups", label: "Groups" },
];

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const { count } = useCart();
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: unread = [] } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => customerApi.notifications(true),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = search.trim();
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  }

  async function onLogout() {
    await logout();
    setMenuOpen(false);
    toast.success("Signed out");
    router.push("/");
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-brand-100/70 bg-cream-50/85 backdrop-blur-lg">
        <div className="container-page flex h-16 items-center gap-3 sm:gap-6">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  isActive(l.href) ? "bg-brand-100 text-brand-700" : "text-ink-600 hover:bg-brand-50",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <form onSubmit={onSearch} className="relative ml-auto hidden max-w-sm flex-1 sm:block" role="search">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              className="input !rounded-full !py-2.5 pl-10"
            />
          </form>

          <div className="ml-auto flex items-center gap-1 sm:ml-0">
            <Link href="/products" aria-label="Search" className="btn-ghost !p-2.5 sm:hidden">
              <Search className="h-5 w-5" />
            </Link>

            {user && (
              <Link href="/account/notifications" aria-label="Notifications" className="btn-ghost relative !p-2.5">
                <Bell className="h-5 w-5" />
                <Badge n={unread.length} />
              </Link>
            )}

            <Link href="/cart" aria-label={`Cart, ${count} items`} className="btn-ghost relative !p-2.5">
              <ShoppingCart className="h-5 w-5" />
              <Badge n={count} />
            </Link>

            {loading ? (
              <span className="ml-1 h-9 w-9 animate-pulse rounded-full bg-brand-100" />
            ) : user ? (
              <div className="relative ml-1" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Account menu"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white shadow-glow"
                >
                  {initials(user.first_name, user.last_name)}
                </button>
                {menuOpen && (
                  <div role="menu" className="card absolute right-0 mt-2 w-56 animate-fade-up p-2">
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-semibold text-ink-800">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="truncate text-xs text-ink-500">{user.email}</p>
                    </div>
                    <div className="my-1 h-px bg-brand-100" />
                    <MenuLink href="/account" icon={UserIcon} label="My account" />
                    <MenuLink href="/account/orders" icon={Package} label="Orders" />
                    <MenuLink href="/account/groups" icon={Users} label="My groups" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={onLogout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 hover:bg-brand-50"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="ml-1 flex items-center gap-1.5">
                <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn-ghost hidden !py-2 sm:inline-flex">
                  Log in
                </Link>
                <Link href="/register" className="btn-primary !py-2">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-100 bg-cream-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-5">
          {[
            { href: "/", label: "Home", icon: Home, exact: true },
            { href: "/products", label: "Shop", icon: ShoppingBag },
            { href: "/groups", label: "Groups", icon: Users },
            { href: "/cart", label: "Cart", icon: ShoppingCart, badge: count },
            { href: user ? "/account" : "/login", label: user ? "Account" : "Log in", icon: UserIcon },
          ].map((t) => {
            const active = t.exact ? pathname === t.href : isActive(t.href);
            return (
              <li key={t.label}>
                <Link
                  href={t.href}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold",
                    active ? "text-brand-600" : "text-ink-500",
                  )}
                >
                  <span className="relative">
                    <t.icon className="h-5 w-5" />
                    {t.badge ? <Badge n={t.badge} /> : null}
                  </span>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

function MenuLink({ href, icon: Icon, label }: { href: string; icon: typeof UserIcon; label: string }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 hover:bg-brand-50"
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
