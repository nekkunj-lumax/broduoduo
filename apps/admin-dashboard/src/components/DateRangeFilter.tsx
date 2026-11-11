"use client";

import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { presetRange, useDateRange } from "@/providers/DateRangeProvider";

const presets = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
];

export function DateRangeFilter() {
  const { range, setRange } = useDateRange();
  const activePreset = presets.find((p) => {
    const r = presetRange(p.days);
    return r.start === range.start && r.end === range.end;
  });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-1.5 shadow-panel">
      <CalendarRange className="ml-2 h-4 w-4 text-ink-faint" />
      <div className="flex rounded-md bg-slate-100 p-0.5">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => setRange(presetRange(p.days))}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-semibold transition-colors",
              activePreset?.label === p.label
                ? "bg-steel-700 text-white"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        type="date"
        aria-label="Start date"
        value={range.start}
        max={range.end}
        onChange={(e) => e.target.value && setRange({ ...range, start: e.target.value })}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-ink focus:border-steel-500 focus:outline-none"
      />
      <span className="text-xs text-ink-faint">to</span>
      <input
        type="date"
        aria-label="End date"
        value={range.end}
        min={range.start}
        onChange={(e) => e.target.value && setRange({ ...range, end: e.target.value })}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-ink focus:border-steel-500 focus:outline-none"
      />
    </div>
  );
}
