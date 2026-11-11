"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { format, subDays } from "date-fns";
import type { DateRange } from "@/lib/types";

interface Ctx {
  range: DateRange;
  setRange: (r: DateRange) => void;
}

const DateRangeContext = createContext<Ctx | null>(null);

export function presetRange(days: number): DateRange {
  const today = new Date();
  return { start: format(subDays(today, days - 1), "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
}

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<DateRange>(() => presetRange(30));
  const value = useMemo(() => ({ range, setRange }), [range]);
  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error("useDateRange must be used inside DateRangeProvider");
  return ctx;
}
