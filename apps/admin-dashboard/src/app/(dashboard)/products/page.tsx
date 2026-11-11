"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import type { Product } from "@/lib/types";
import { int, money, num } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";

const PAGE_SIZE = 20;

const columns: Column<Product>[] = [
  { key: "name", header: "Product", cell: (p) => <div><p className="font-medium">{p.name}</p><p className="font-mono text-xs text-ink-muted">{p.sku}</p></div> },
  { key: "price", header: "Price", align: "right", cell: (p) => money(p.individual_price, p.currency) },
  { key: "gprice", header: "Group price", align: "right", cell: (p) => <span>{money(p.group_price, p.currency)} <span className="text-xs text-emerald-700">−{num(p.discount_percentage).toFixed(0)}%</span></span> },
  { key: "gsize", header: "Group size", align: "right", cell: (p) => (p.is_group_buy_enabled ? int(p.group_size) : "—") },
  { key: "group", header: "Group buy", cell: (p) => <StatusBadge value={p.is_group_buy_enabled ? "active" : "inactive"} label={p.is_group_buy_enabled ? "Enabled" : "Off"} /> },
  { key: "stock", header: "In stock", align: "right", cell: (p) => (p.available_qty == null ? "—" : int(p.available_qty)) },
  { key: "sold", header: "Units sold", align: "right", cell: (p) => int(p.units_sold) },
  { key: "sg", header: "Successful groups", align: "right", cell: (p) => int(p.successful_groups_count) },
  { key: "rating", header: "Rating", align: "right", cell: (p) => `${num(p.rating_avg).toFixed(1)} (${int(p.rating_count)})` },
];

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["products", page], queryFn: () => adminApi.adminProducts({ page, page_size: PAGE_SIZE }) });
  return (
    <>
      <PageHeader title="Products" description="Catalog with pricing, stock and group-buy configuration" />
      <DataTable columns={columns} rows={q.data?.items} rowKey={(p) => p.id} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} pagination={{ page, pages: q.data?.pages, total: q.data?.total, pageSize: PAGE_SIZE, onPage: setPage }} />
    </>
  );
}
