"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { adminApi } from "@/lib/api";
import type { Participant } from "@/lib/types";
import { dateTime, int, money, num } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ErrorBlock, LoadingBlock } from "@/components/QueryState";

const columns: Column<Participant>[] = [
  {
    key: "user",
    header: "Participant",
    cell: (p) => (
      <div>
        <p className="font-medium">{[p.user_first_name, p.user_last_name].filter(Boolean).join(" ") || "—"}</p>
        <p className="font-mono text-xs text-ink-muted">{p.user_id.slice(0, 8)}</p>
      </div>
    ),
  },
  { key: "pay", header: "Payment", cell: (p) => <StatusBadge value={p.payment_status} /> },
  { key: "qty", header: "Qty", align: "right", cell: (p) => int(p.quantity) },
  { key: "amount", header: "Amount", align: "right", cell: (p) => money(p.amount) },
  { key: "invite", header: "Via invite", cell: (p) => (p.joined_via_invite ? "Yes" : "No") },
  { key: "joined", header: "Joined", cell: (p) => dateTime(p.created_at) },
  { key: "confirmed", header: "Confirmed", cell: (p) => dateTime(p.confirmed_at) },
];

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ["group", id], queryFn: () => adminApi.group(id) });
  const g = q.data;

  if (q.isLoading) return <LoadingBlock />;
  if (q.isError || !g) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;

  const paid = g.participants.filter((p) => p.payment_status === "paid").reduce((s, p) => s + num(p.amount), 0);

  return (
    <>
      <Link href="/groups" className="mb-3 inline-flex items-center gap-1 text-sm text-steel-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> All groups
      </Link>
      <PageHeader
        title={g.product?.name ?? "Buying group"}
        description={`Group ${g.id} · created by ${g.creator_name ?? "unknown"}`}
        actions={<StatusBadge value={g.status} />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Progress" value={`${g.confirmed_participants} / ${g.required_participants}`} hint={`${Math.round(g.progress_percent)}% · ${g.remaining_participants} remaining`} />
        <KpiCard label="Pending participants" value={int(g.pending_participants)} tone="amber" />
        <KpiCard label="Confirmed payments" value={money(paid, g.currency)} tone="green" />
        <KpiCard label="Group price" value={money(g.group_price, g.currency)} hint={g.product ? `Individual ${money(g.product.individual_price, g.currency)}` : undefined} />
      </div>
      <div className="panel mb-6 grid gap-4 p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Invite code", <span key="c" className="font-mono">{g.invite_code}</span>],
          ["Created", dateTime(g.created_at)],
          ["Expires", dateTime(g.expires_at)],
          ["Completed", dateTime(g.completed_at)],
        ].map(([label, value]) => (
          <div key={label as string}>
            <p className="label">{label}</p>
            <p>{value}</p>
          </div>
        ))}
      </div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Participants ({g.participants.length})</h2>
      <DataTable columns={columns} rows={g.participants} rowKey={(p) => p.id} emptyMessage="No participants yet." />
    </>
  );
}
