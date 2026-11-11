"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, PlusCircle, Timer, Users, XCircle } from "lucide-react";
import { adminApi } from "@/lib/api";
import { duration, int, pct } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard } from "@/components/ChartCard";
import { DonutChart, SimpleBarChart } from "@/components/charts";
import { ErrorBlock } from "@/components/QueryState";
import { useDateRange } from "@/providers/DateRangeProvider";

export default function GroupAnalyticsPage() {
  const { range } = useDateRange();
  const q = useQuery({ queryKey: ["group-analytics", range], queryFn: () => adminApi.groupAnalytics(range) });
  const d = q.data;
  const outcome = d
    ? [
        { name: "Successful", value: d.successful_groups, color: "#2f9e73" },
        { name: "Expired", value: d.expired_groups, color: "#d49a2a" },
        { name: "Cancelled", value: d.cancelled_groups, color: "#8696ad" },
      ]
    : [];

  return (
    <>
      <PageHeader title="Group analytics" description="Group-buying funnel and lifecycle performance" actions={<DateRangeFilter />} />
      {q.isError && <ErrorBlock error={q.error} onRetry={() => q.refetch()} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard loading={q.isLoading} icon={PlusCircle} label="Groups created" value={d && int(d.groups_created)} />
        <KpiCard loading={q.isLoading} icon={CheckCircle2} tone="green" label="Success rate" value={d && pct(d.group_success_rate)} hint="Successful ÷ (successful + expired + cancelled)" />
        <KpiCard loading={q.isLoading} icon={Users} label="Avg. participants (successful)" value={d && d.average_participants_per_successful_group.toFixed(1)} />
        <KpiCard loading={q.isLoading} icon={Timer} label="Avg. time to complete" value={d && duration(d.average_completion_seconds)} />
        <KpiCard loading={q.isLoading} icon={Clock} tone="amber" label="Expired groups" value={d && int(d.expired_groups)} />
        <KpiCard loading={q.isLoading} icon={XCircle} tone="slate" label="Cancelled groups" value={d && int(d.cancelled_groups)} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Outcome distribution" loading={q.isLoading} empty={!d || outcome.every((o) => o.value === 0)}>
          <DonutChart data={outcome} />
        </ChartCard>
        <ChartCard title="Group counts" loading={q.isLoading} empty={!d}>
          <SimpleBarChart
            data={[
              { name: "Created", value: d?.groups_created ?? 0 },
              { name: "Successful", value: d?.successful_groups ?? 0 },
              { name: "Expired", value: d?.expired_groups ?? 0 },
              { name: "Cancelled", value: d?.cancelled_groups ?? 0 },
            ]}
            series={[{ key: "value", label: "Groups" }]}
          />
        </ChartCard>
      </div>
    </>
  );
}
