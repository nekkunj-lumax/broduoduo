import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  OPEN: "bg-steel-100 text-steel-800",
  SUCCESSFUL: "bg-emerald-100 text-emerald-800",
  EXPIRED: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-slate-200 text-slate-700",
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  PROCESSING: "bg-steel-100 text-steel-800",
  SHIPPED: "bg-cyan-100 text-cyan-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  REFUNDED: "bg-red-100 text-red-800",
  paid: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-red-100 text-red-800",
  group: "bg-steel-100 text-steel-800",
  individual: "bg-slate-200 text-slate-700",
  active: "bg-emerald-100 text-emerald-800",
  inactive: "bg-slate-200 text-slate-700",
  low: "bg-red-100 text-red-800",
  ok: "bg-emerald-100 text-emerald-800",
};

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        styles[value] ?? "bg-slate-100 text-slate-700",
      )}
    >
      {label ?? value}
    </span>
  );
}
