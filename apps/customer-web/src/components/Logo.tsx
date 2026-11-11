import Link from "next/link";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2", className)} aria-label="Brodoudou home">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-glow">
        <MapPin className="h-5 w-5" aria-hidden />
      </span>
      <span className="font-display text-2xl font-semibold tracking-tight text-ink-800">
        Brodo<span className="text-brand-500">udou</span>
      </span>
    </Link>
  );
}
