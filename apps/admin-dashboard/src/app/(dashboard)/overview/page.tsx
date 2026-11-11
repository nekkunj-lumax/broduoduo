"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  CircleDollarSign,
  Percent,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Undo2,
  UserPlus,
  Users,
  UsersRound,
  Boxes,
  Activity,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { dateOnly, int, money, moneyCompact, pct } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard } from "@/components/ChartCard";
import { DonutChart, SimpleBarChart } from "@/components/charts";
import { ErrorBlock } from "@/components/QueryState";
import { useDateRange } from "@/providers/DateRangeProvider";

export default function OverviewPage() {
  const { range } = useDateRange();
  const overview = useQuery({
    queryKey: ["overview", range],
    queryFn: () => adminApi.overview(range),
  });
  const sales = useQuery({
    queryKey: ["sales", range],
    queryFn: () => adminApi.sales(range),
  });
  const o = overview.data;
  const l = overview.isLoading;

  const groupOutcome = o
    ? [
        { name: "Successful", value: o.successful_groups, color: "#2f9e73" },
        { name: "Expired", value: o.expired_groups, color: "#d49a2a" },
        { name: "Cancelled", value: o.cancelled_groups, color: "#8696ad" },
      ]
    : [];

  const revenueFlow = o
    ? [
        { name: "GMV", value: o.gmv },
        { name: "Paid orders", value: o.paid_order_value },
        { name: "Refunds", value: o.refund_amount },
        { name: "Net sales", value: o.net_sales_revenue },
      ]
    : [];

  const topProducts = (sales.data ?? [])
    .filter((p) => p.revenue > 0)
    .slice(0, 8)
    .map((p) => ({ name: p.name, revenue: p.revenue }));

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          o
            ? `${dateOnly(o.period_start)} – ${dateOnly(o.period_end)} · all figures from live backend aggregates`
            : "Business performance summary"
        }
        actions={<DateRangeFilter />}
      />

      {overview.isError && <ErrorBlock error={overview.error} onRetry={() => overview.refetch()} />}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard loading={l} icon={CircleDollarSign} label="Net sales revenue" value={o && money(o.net_sales_revenue)} hint="Paid order value − refunds" />
        <KpiCard loading={l} icon={TrendingUp} label="GMV" value={o && money(o.gmv)} hint="Non-cancelled merchandise value (not profit)" />
        <KpiCard loading={l} icon={Receipt} label="Paid orders" value={o && int(o.total_orders)} hint={o ? `${int(o.total_units_sold)} units sold` : undefined} />
        <KpiCard loading={l} icon={Banknote} label="Average order value" value={o && money(o.average_order_value)} />
        <KpiCard loading={l} icon={Undo2} tone="red" label="Refunds" value={o && money(o.refund_amount)} />
        <KpiCard loading={l} icon={UsersRound} tone="green" label="Group success rate" value={o && pct(o.group_success_rate)} hint={o ? `${int(o.successful_groups)} successful of ${int(o.successful_groups + o.expired_groups + o.cancelled_groups)} closed` : undefined} />
        <KpiCard loading={l} icon={Percent} tone="green" label="Group conversion" value={o && pct(o.group_buying_conversion_rate)} hint="Paid group orders ÷ group checkouts" />
        <KpiCard loading={l} icon={Activity} tone="amber" label="Active groups" value={o && int(o.active_groups)} hint="Currently open" />
        <KpiCard loading={l} icon={Users} tone="slate" label="Total customers" value={o && int(o.total_customers)} />
        <KpiCard loading={l} icon={UserPlus} tone="slate" label="New customers" value={o && int(o.new_customers)} hint="Registered in period" />
        <KpiCard loading={l} icon={ShoppingBag} tone="slate" label="Active customers" value={o && int(o.active_customers)} hint="With a paid order in period" />
        <KpiCard loading={l} icon={Boxes} tone="slate" label="Active products" value={o && int(o.total_products)} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Revenue flow" subtitle="From gross merchandise value to net sales" loading={l} empty={!o}>
            <SimpleBarChart data={revenueFlow} series={[{ key: "value", label: "Amount", color: "#376488" }]} format={moneyCompact} />
          </ChartCard>
        </div>
        <ChartCard title="Group outcomes" subtitle="Closed groups in period" loading={l} empty={!o || groupOutcome.every((g) => g.value === 0)}>
          <DonutChart data={groupOutcome} />
        </ChartCard>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Top products by revenue" subtitle="Paid orders in selected period" loading={sales.isLoading} empty={topProducts.length === 0} height={320}>
            <SimpleBarChart layout="horizontal" data={topProducts} series={[{ key: "revenue", label: "Revenue", color: "#477da4" }]} format={moneyCompact} yWidth={150} />
          </ChartCard>
        </div>
        <div className="panel p-5">
          <h3 className="text-sm font-semibold text-ink">KPI definitions</h3>
          <p className="mb-3 text-xs text-ink-muted">Served by the analytics API</p>
          {l ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />)}
            </div>
          ) : (
            <dl className="space-y-3 text-xs">
              {Object.entries(o?.formulas ?? {}).map(([k, v]) => (
                <div key={k}>
                  <dt className="font-semibold capitalize text-ink">{k.replace(/_/g, " ")}</dt>
                  <dd className="font-mono text-ink-muted">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>
    </>
  );
}
