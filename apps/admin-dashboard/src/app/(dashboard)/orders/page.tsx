"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import type { Order } from "@/lib/types";
import { dateTime, int, money } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";

const PAGE_SIZE = 20;
const STATUSES = ["", "PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
const TYPES = ["", "individual", "group"];

const columns: Column<Order>[] = [
  { key: "num", header: "Order", cell: (o) => <span className="font-mono text-xs font-medium">{o.order_number}</span> },
  { key: "type", header: "Type", cell: (o) => <StatusBadge value={o.purchase_type} /> },
  { key: "status", header: "Status", cell: (o) => <StatusBadge value={o.status} /> },
  {
    key: "items",
    header: "Items",
    cell: (o) => (
      <span className="text-ink-muted">
        {o.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ") || "—"}
      </span>
    ),
    className: "max-w-xs truncate",
  },
  { key: "units", header: "Units", align: "right", cell: (o) => int(o.items.reduce((s, i) => s + i.quantity, 0)) },
  { key: "discount", header: "Discount", align: "right", cell: (o) => money(o.discount_amount, o.currency) },
  { key: "total", header: "Total", align: "right", cell: (o) => <span className="font-semibold">{money(o.total_amount, o.currency)}</span> },
  { key: "paid", header: "Paid at", cell: (o) => dateTime(o.paid_at) },
  { key: "created", header: "Created", cell: (o) => dateTime(o.created_at) },
];

export default function OrdersPage() {
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["orders", status, type, page],
    queryFn: () => adminApi.orders({ status, purchase_type: type, page, page_size: PAGE_SIZE }),
  });
  return (
    <>
      <PageHeader
        title="Orders"
        description="All individual and group orders"
        actions={
          <>
            <select className="input !w-40" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Purchase type">
              {TYPES.map((t) => <option key={t} value={t}>{t || "All types"}</option>)}
            </select>
            <select className="input !w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Order status">
              {STATUSES.map((s) => <option key={s} value={s}>{s || "All statuses"}</option>)}
            </select>
          </>
        }
      />
      <DataTable columns={columns} rows={q.data?.items} rowKey={(o) => o.id} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} emptyMessage="No orders match these filters." pagination={{ page, pages: q.data?.pages, total: q.data?.total, pageSize: PAGE_SIZE, onPage: setPage }} />
    </>
  );
}
