import Link from "next/link";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-brand-100 bg-white/60 pb-24 pt-10 md:pb-10">
      <div className="container-page flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Logo />
          <p className="mt-2 max-w-xs text-sm text-ink-500">Shop together, save together. Group-buy deals with friends.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-600" aria-label="Footer">
          <Link href="/products" className="hover:text-brand-600">Shop</Link>
          <Link href="/groups" className="hover:text-brand-600">Open groups</Link>
          <Link href="/account/orders" className="hover:text-brand-600">Orders</Link>
          <Link href="/account" className="hover:text-brand-600">Account</Link>
        </nav>
      </div>
      <p className="container-page mt-8 text-xs text-ink-400">© {new Date().getFullYear()} Brodoudou. All rights reserved.</p>
    </footer>
  );
}
