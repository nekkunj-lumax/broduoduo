"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import type { Group } from "@/lib/types";
import { dateTime, money } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";

const PAGE_SIZE = 20;
const STATUSES = ["", "OPEN", "SUCCESSFUL", "EXPIRED", "CANCELLED"];

export default function GroupsPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["groups", status, page],
    queryFn: () => adminApi.groups({ status, page, page_size: PAGE_SIZE }),
  });

  const columns: Column<Group>[] = [
    {
      key: "product",
      header: "Product",
      cell: (g) => (
        <div>
          <p className="font-medium">{g.product?.name ?? "—"}</p>
          <p className="font-mono text-xs text-ink-muted">{g.id.slice(0, 8)}</p>
        </div>
      ),
    },
    { key: "creator", header: "Creator", cell: (g) => g.creator_name ?? "—" },
    { key: "status", header: "Status", cell: (g) => <StatusBadge value={g.status} /> },
    {
      key: "progress",
      header: "Progress",
      cell: (g) => (
        <div className="w-36">
          <div className="mb-1 flex justify-between text-xs text-ink-muted">
            <span>{g.confirmed_participants}/{g.required_participants}</span>
            <span>{Math.round(g.progress_percent)}%</span>
          </div>
          <div className="h-1.5 rounded bg-slate-200">
            <div className="h-1.5 rounded bg-steel-600" style={{ width: `${Math.min(100, g.progress_percent)}%` }} />
          </div>
        </div>
      ),
    },
    { key: "price", header: "Group price", align: "right", cell: (g) => money(g.group_price, g.currency) },
    { key: "paid", header: "Confirmed payments", align: "right", cell: (g) => money(g.total_confirmed_payment ?? 0, g.currency) },
    { key: "expires", header: "Expires", cell: (g) => dateTime(g.expires_at) },
    { key: "created", header: "Created", cell: (g) => dateTime(g.created_at) },
  ];

  return (
    <>
      <PageHeader
        title="Buying groups"
        description="All group-buy sessions across the platform"
        actions={
          <select className="input !w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
            {STATUSES.map((s) => <option key={s} value={s}>{s || "All statuses"}</option>)}
          </select>
        }
      />
      <DataTable
        columns={columns}
        rows={q.data?.items}
        rowKey={(g) => g.id}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        onRowClick={(g) => router.push(`/groups/${g.id}`)}
        emptyMessage="No groups match this filter."
        pagination={{ page, pages: q.data?.pages, total: q.data?.total, pageSize: PAGE_SIZE, onPage: setPage }}
      />
    </>
  );
}
