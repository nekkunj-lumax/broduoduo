import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  confirmed: number;
  required: number;
  pending?: number;
  status?: string;
  size?: "sm" | "md";
  className?: string;
}

export function GroupProgress({ confirmed, required, pending = 0, status = "OPEN", size = "md", className }: Props) {
  const safeRequired = Math.max(required, 1);
  const pct = Math.min(100, Math.round((confirmed / safeRequired) * 100));
  const remaining = Math.max(0, required - confirmed);
  const done = status === "SUCCESSFUL" || confirmed >= required;

  return (
    <div className={cn("w-full", className)}>
      <div className={cn("flex items-center justify-between", size === "sm" ? "text-xs" : "text-sm")}>
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink-700">
          <Users className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
          {confirmed}/{required} joined
        </span>
        <span className={cn("font-medium", done ? "text-emerald-600" : "text-brand-600")}>
          {done ? "Group complete!" : `${remaining} more needed`}
        </span>
      </div>

      <div
        className={cn("mt-2 overflow-hidden rounded-full bg-brand-100", size === "sm" ? "h-1.5" : "h-2.5")}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            done ? "bg-emerald-500" : "bg-gradient-to-r from-brand-300 to-brand-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {size === "md" && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {Array.from({ length: Math.min(required, 20) }).map((_, i) => {
            const filled = i < confirmed;
            const isPending = !filled && i < confirmed + pending;
            return (
              <span
                key={i}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                  filled && "border-brand-500 bg-brand-500 text-white",
                  isPending && "border-dashed border-amber-400 bg-amber-50 text-amber-600",
                  !filled && !isPending && "border-dashed border-brand-200 bg-white text-brand-200",
                )}
                title={filled ? "Joined" : isPending ? "Awaiting payment" : "Open spot"}
              >
                {filled ? "✓" : isPending ? "…" : "+"}
              </span>
            );
          })}
          {pending > 0 && <span className="ml-1 text-xs text-ink-500">{pending} awaiting payment</span>}
        </div>
      )}
    </div>
  );
}
