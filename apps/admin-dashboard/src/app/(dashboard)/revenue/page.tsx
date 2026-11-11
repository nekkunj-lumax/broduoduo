"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { int, money, moneyCompact, pct } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard } from "@/components/ChartCard";
import { DonutChart, SimpleBarChart } from "@/components/charts";
import { ErrorBlock } from "@/components/QueryState";
import { useDateRange } from "@/providers/DateRangeProvider";

export default function RevenuePage() {
  const { range } = useDateRange();
  const q = useQuery({ queryKey: ["revenue", range], queryFn: () => adminApi.revenue(range) });
  const d = q.data;
  const types = Object.entries(d?.by_type ?? {}).map(([name, v]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    revenue: v.revenue,
    orders: v.orders,
  }));
  const waterfall = d
    ? [
        { name: "GMV", value: d.gmv },
        { name: "Paid value", value: d.paid_order_value },
        { name: "Refunds", value: d.refund_amount },
        { name: "Net sales", value: d.net_sales_revenue },
      ]
    : [];
  const refundRate = d && d.paid_order_value > 0 ? (d.refund_amount / d.paid_order_value) * 100 : 0;

  return (
    <>
      <PageHeader title="Revenue" description="Revenue composition, refunds and net sales" actions={<DateRangeFilter />} />
      {q.isError && <ErrorBlock error={q.error} onRetry={() => q.refetch()} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard loading={q.isLoading} label="Net sales revenue" value={d && money(d.net_sales_revenue)} />
        <KpiCard loading={q.isLoading} label="Paid order value" value={d && money(d.paid_order_value)} />
        <KpiCard loading={q.isLoading} tone="red" label="Refund rate" value={d && pct(refundRate)} hint={d ? `${money(d.refund_amount)} refunded` : undefined} />
        <KpiCard loading={q.isLoading} label="Average order value" value={d && money(d.average_order_value)} hint={d ? `${int(d.total_orders)} paid orders` : undefined} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Revenue waterfall" loading={q.isLoading} empty={!d}>
            <SimpleBarChart data={waterfall} series={[{ key: "value", label: "Amount" }]} format={moneyCompact} />
          </ChartCard>
        </div>
        <ChartCard title="Revenue by purchase type" loading={q.isLoading} empty={types.length === 0}>
          <DonutChart data={types.map((t) => ({ name: t.name, value: t.revenue }))} format={money} />
        </ChartCard>
      </div>
      <div className="panel mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 text-left">Purchase type</th>
              <th className="px-4 py-3 text-right">Orders</th>
              <th className="px-4 py-3 text-right">Revenue</th>
              <th className="px-4 py-3 text-right">Avg. order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {types.map((t) => (
              <tr key={t.name}>
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{int(t.orders)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(t.revenue)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(t.orders ? t.revenue / t.orders : 0)}</td>
              </tr>
            ))}
            {!q.isLoading && types.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-muted">No paid orders in this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
