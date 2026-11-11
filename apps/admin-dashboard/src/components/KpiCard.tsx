import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "steel",
  loading,
}: {
  label: string;
  value?: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "steel" | "green" | "amber" | "red" | "slate";
  loading?: boolean;
}) {
  const tones = {
    steel: "bg-steel-100 text-steel-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
        {Icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", tones[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-28 animate-pulse rounded bg-slate-200" />
      ) : (
        <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{value ?? "—"}</p>
      )}
      {hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
