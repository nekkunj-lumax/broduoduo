"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyBlock, ErrorBlock } from "./QueryState";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  /** Provide a sort value to enable client-side sorting on this column. */
  sortValue?: (row: T) => string | number;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows?: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  pagination?: {
    page: number;
    pages?: number;
    total?: number;
    pageSize: number;
    hasNext?: boolean;
    onPage: (p: number) => void;
  };
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  emptyMessage,
  onRowClick,
  pagination,
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const sorted = useMemo(() => {
    if (!rows) return [];
    const col = columns.find((c) => c.key === sort?.key);
    if (!sort || !col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const r = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? r : -r;
    });
  }, [rows, columns, sort]);

  if (error) return <ErrorBlock error={error} onRetry={onRetry} />;

  const alignCls = { left: "text-left", right: "text-right", center: "text-center" };
  const hasNext = pagination
    ? (pagination.hasNext ?? (pagination.pages ? pagination.page < pagination.pages : false))
    : false;

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns.map((c) => {
                const sortable = !!c.sortValue;
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    className={cn(
                      "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted",
                      alignCls[c.align ?? "left"],
                    )}
                  >
                    {sortable ? (
                      <button
                        className="inline-flex items-center gap-1 hover:text-ink"
                        onClick={() =>
                          setSort(
                            active
                              ? sort!.dir === "asc"
                                ? { key: c.key, dir: "desc" }
                                : null
                              : { key: c.key, dir: "asc" },
                          )
                        }
                      >
                        {c.header}
                        {active &&
                          (sort!.dir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          ))}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-slate-200" />
                      </td>
                    ))}
                  </tr>
                ))
              : sorted.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(onRowClick && "cursor-pointer hover:bg-steel-50")}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-4 py-3 text-ink",
                          alignCls[c.align ?? "left"],
                          c.align === "right" && "tabular-nums",
                          c.className,
                        )}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!loading && sorted.length === 0 && <EmptyBlock message={emptyMessage} />}
      {pagination && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-ink-muted">
          <span>
            Page {pagination.page}
            {pagination.pages ? ` of ${pagination.pages}` : ""}
            {pagination.total !== undefined ? ` · ${pagination.total.toLocaleString()} total` : ""}
          </span>
          <div className="flex gap-1">
            <button
              className="btn-secondary !px-2 !py-1"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPage(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              className="btn-secondary !px-2 !py-1"
              disabled={!hasNext}
              onClick={() => pagination.onPage(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
