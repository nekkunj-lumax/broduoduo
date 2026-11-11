"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  expiresAt: string;
  onExpire?: () => void;
  /** Compact single-line pill (for cards). */
  compact?: boolean;
  className?: string;
}

function remaining(expiresAt: string): number {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

const pad = (n: number) => String(n).padStart(2, "0");

export function CountdownTimer({ expiresAt, onExpire, compact = false, className }: Props) {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    setMs(remaining(expiresAt));
    let fired = false;
    const id = window.setInterval(() => {
      const left = remaining(expiresAt);
      setMs(left);
      if (left === 0 && !fired) {
        fired = true;
        onExpire?.();
        window.clearInterval(id);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, onExpire]);

  // Avoid SSR/client mismatch: render placeholder until mounted.
  if (ms === null) return <span className={cn("inline-block h-5 w-20 rounded bg-brand-50", className)} />;

  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const urgent = ms > 0 && ms < 60 * 60 * 1000;

  if (ms === 0) {
    return <span className={cn("text-sm font-semibold text-stone-500", className)}>Ended</span>;
  }

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
          urgent ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-700",
          className,
        )}
        aria-label="Time left"
      >
        <Timer className="h-3.5 w-3.5" aria-hidden />
        {days > 0 ? `${days}d ${pad(hours)}h` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`}
      </span>
    );
  }

  const units = [
    ...(days > 0 ? [{ label: "Days", value: days }] : []),
    { label: "Hrs", value: hours },
    { label: "Min", value: minutes },
    { label: "Sec", value: seconds },
  ];

  return (
    <div className={cn("flex items-center gap-2", className)} role="timer" aria-label="Time left">
      {units.map((u, idx) => (
        <div key={u.label} className="flex items-center gap-2">
          <div
            className={cn(
              "flex min-w-[3.5rem] flex-col items-center rounded-2xl px-3 py-2",
              urgent ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-700",
            )}
          >
            <span className="font-display text-2xl font-semibold tabular-nums leading-none">{pad(u.value)}</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider opacity-70">{u.label}</span>
          </div>
          {idx < units.length - 1 && <span className="font-display text-xl text-brand-300">:</span>}
        </div>
      ))}
    </div>
  );
}
