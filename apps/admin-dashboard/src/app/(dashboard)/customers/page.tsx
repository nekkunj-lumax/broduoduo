"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, UserPlus, Activity } from "lucide-react";
import { adminApi } from "@/lib/api";
import type { Customer } from "@/lib/types";
import { dateTime, int } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { KpiCard } from "@/components/KpiCard";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { useDateRange } from "@/providers/DateRangeProvider";

const PAGE_SIZE = 20;

const columns: Column<Customer>[] = [
  { key: "name", header: "Name", cell: (c) => <span className="font-medium">{c.first_name} {c.last_name}</span> },
  { key: "email", header: "Email", cell: (c) => c.email },
  { key: "roles", header: "Roles", cell: (c) => <div className="flex gap-1">{c.roles.map((r) => <StatusBadge key={r} value={r} />)}</div> },
  { key: "active", header: "Status", cell: (c) => <StatusBadge value={c.is_active ? "active" : "inactive"} /> },
  { key: "created", header: "Joined", cell: (c) => dateTime(c.created_at) },
  { key: "login", header: "Last login", cell: (c) => dateTime(c.last_login_at) },
];

export default function CustomersPage() {
  const { range } = useDateRange();
  const [page, setPage] = useState(1);
  const stats = useQuery({ queryKey: ["customer-analytics", range], queryFn: () => adminApi.customerAnalytics(range) });
  const list = useQuery({ queryKey: ["customers", page], queryFn: () => adminApi.customers({ page, page_size: PAGE_SIZE }) });
  return (
    <>
      <PageHeader title="Customers" description="Registered accounts and acquisition" actions={<DateRangeFilter />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard icon={Users} loading={stats.isLoading} label="Total customers" value={stats.data && int(stats.data.total_customers)} />
        <KpiCard icon={UserPlus} tone="green" loading={stats.isLoading} label="New in period" value={stats.data && int(stats.data.new_customers)} />
        <KpiCard icon={Activity} tone="amber" loading={stats.isLoading} label="Active in period" value={stats.data && int(stats.data.active_customers)} hint="Placed a paid order" />
      </div>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(c) => c.id} loading={list.isLoading} error={list.error} onRetry={() => list.refetch()} pagination={{ page, pages: list.data?.pages, total: list.data?.total, pageSize: PAGE_SIZE, onPage: setPage }} />
    </>
  );
}
