"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import type { AuditLog } from "@/lib/types";
import { dateTime } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";

const PAGE_SIZE = 50;

const columns: Column<AuditLog>[] = [
  { key: "when", header: "Time", cell: (l) => <span className="whitespace-nowrap">{dateTime(l.created_at)}</span> },
  { key: "action", header: "Action", cell: (l) => <span className="font-mono text-xs font-medium">{l.action}</span> },
  { key: "type", header: "Resource", cell: (l) => l.resource_type },
  { key: "rid", header: "Resource ID", cell: (l) => <span className="font-mono text-xs text-ink-muted">{l.resource_id?.slice(0, 8) ?? "—"}</span> },
  { key: "actor", header: "Actor", cell: (l) => <span className="font-mono text-xs text-ink-muted">{l.actor_id.slice(0, 8)}</span> },
  { key: "details", header: "Details", cell: (l) => <code className="block max-w-md truncate text-xs text-ink-muted">{l.details ? JSON.stringify(l.details) : "—"}</code> },
];

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["audit-logs", page], queryFn: () => adminApi.auditLogs({ page, page_size: PAGE_SIZE }) });
  return (
    <>
      <PageHeader title="Audit logs" description="Privileged actions performed in the admin console" />
      <DataTable columns={columns} rows={q.data} rowKey={(l) => l.id} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} emptyMessage="No audit events recorded." pagination={{ page, pageSize: PAGE_SIZE, hasNext: (q.data?.length ?? 0) === PAGE_SIZE, onPage: setPage }} />
    </>
  );
}
