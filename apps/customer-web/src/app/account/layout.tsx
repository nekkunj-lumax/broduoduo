"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Package, UserRound, Users } from "lucide-react";
import { useRequireAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/States";

const TABS = [
  { href: "/account", label: "Profile", icon: UserRound, exact: true },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/groups", label: "Groups", icon: Users },
  { href: "/account/notifications", label: "Alerts", icon: Bell },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useRequireAuth();
  const pathname = usePathname();

  if (loading || !user) return <Skeleton className="h-96" />;

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-500">My account</p>
        <h1 className="font-display text-3xl font-semibold text-ink-800 sm:text-4xl">Hi, {user.first_name}</h1>
      </div>

      <nav aria-label="Account" className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className={cn("chip shrink-0", active && "chip-active")}>
              <t.icon className="h-4 w-4" /> {t.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
