import type { ReactNode } from "react";
import { EmptyBlock } from "./QueryState";

export function ChartCard({
  title,
  subtitle,
  children,
  loading,
  empty,
  height = 280,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  loading?: boolean;
  empty?: boolean;
  height?: number;
}) {
  return (
    <div className="panel p-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {subtitle && <p className="mb-3 text-xs text-ink-muted">{subtitle}</p>}
      <div style={{ height }} className={subtitle ? "" : "mt-3"}>
        {loading ? (
          <div className="h-full animate-pulse rounded bg-slate-100" />
        ) : empty ? (
          <EmptyBlock />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
