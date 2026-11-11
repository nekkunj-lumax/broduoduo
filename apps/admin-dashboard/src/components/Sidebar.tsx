"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  DollarSign,
  FileDown,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  ScrollText,
  Settings,
  ShoppingCart,
  Users,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminAuth } from "@/providers/AdminAuthProvider";

const nav = [
  {
    label: "Insights",
    items: [
      { href: "/overview", label: "Overview", icon: LayoutDashboard },
      { href: "/sales", label: "Sales", icon: Receipt },
      { href: "/revenue", label: "Revenue", icon: DollarSign },
      { href: "/group-analytics", label: "Group analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/groups", label: "Buying groups", icon: UsersRound },
      { href: "/orders", label: "Orders", icon: ShoppingCart },
      { href: "/products", label: "Products", icon: Package },
      { href: "/inventory", label: "Inventory", icon: Boxes },
      { href: "/customers", label: "Customers", icon: Users },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/reports", label: "Reports", icon: FileDown },
      { href: "/audit-logs", label: "Audit logs", icon: ScrollText },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAdminAuth();
  const initials = user ? `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase() : "";
  const role = user?.roles.find((r) => ["owner", "admin", "staff"].includes(r.name))?.name;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-steel-950 text-slate-300">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-steel-500 text-white">
          <ClipboardList className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">Brodoudou</p>
          <p className="text-[11px] uppercase tracking-widest text-steel-300">Admin · BI</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {nav.map((section) => (
          <div key={section.label}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-steel-400/80">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        "flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-colors",
                        active
                          ? "border-steel-400 bg-white/10 font-medium text-white"
                          : "border-transparent text-slate-400 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-steel-700 text-xs font-semibold text-white">
            {initials || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {user ? `${user.first_name} ${user.last_name}` : ""}
            </p>
            <p className="truncate text-xs capitalize text-steel-300">{role}</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
