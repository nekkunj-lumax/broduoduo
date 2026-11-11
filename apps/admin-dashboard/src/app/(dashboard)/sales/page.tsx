"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import type { ProductSales } from "@/lib/types";
import { int, money, moneyCompact } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard } from "@/components/ChartCard";
import { SimpleBarChart } from "@/components/charts";
import { DataTable, type Column } from "@/components/DataTable";
import { useDateRange } from "@/providers/DateRangeProvider";

const columns: Column<ProductSales>[] = [
  { key: "name", header: "Product", cell: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
  { key: "sku", header: "SKU", cell: (r) => <span className="font-mono text-xs text-ink-muted">{r.sku}</span> },
  { key: "ip", header: "Indiv. price", align: "right", cell: (r) => money(r.individual_price), sortValue: (r) => r.individual_price },
  { key: "gp", header: "Group price", align: "right", cell: (r) => money(r.group_price), sortValue: (r) => r.group_price },
  { key: "iu", header: "Indiv. units", align: "right", cell: (r) => int(r.individual_units), sortValue: (r) => r.individual_units },
  { key: "gu", header: "Group units", align: "right", cell: (r) => int(r.group_units), sortValue: (r) => r.group_units },
  { key: "units", header: "Units sold", align: "right", cell: (r) => int(r.units_sold), sortValue: (r) => r.units_sold },
  { key: "rev", header: "Revenue", align: "right", cell: (r) => <span className="font-semibold">{money(r.revenue)}</span>, sortValue: (r) => r.revenue },
];

export default function SalesPage() {
  const { range } = useDateRange();
  const q = useQuery({ queryKey: ["sales", range], queryFn: () => adminApi.sales(range) });
  const rows = q.data ?? [];
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalUnits = rows.reduce((s, r) => s + r.units_sold, 0);
  const groupUnits = rows.reduce((s, r) => s + r.group_units, 0);
  const top = rows.filter((r) => r.units_sold > 0).slice(0, 10).map((r) => ({
    name: r.name,
    "Individual": r.individual_units,
    "Group": r.group_units,
  }));

  return (
    <>
      <PageHeader title="Sales" description="Product-level sales performance" actions={<DateRangeFilter />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard loading={q.isLoading} label="Product revenue" value={money(totalRevenue)} />
        <KpiCard loading={q.isLoading} label="Units sold" value={int(totalUnits)} />
        <KpiCard loading={q.isLoading} label="Group-buy share of units" value={totalUnits ? `${((groupUnits / totalUnits) * 100).toFixed(1)}%` : "—"} />
      </div>
      <div className="mb-6">
        <ChartCard title="Units sold by channel" subtitle="Top products — individual vs group purchases" loading={q.isLoading} empty={top.length === 0} height={300}>
          <SimpleBarChart
            data={top}
            series={[
              { key: "Individual", label: "Individual", stackId: "u", color: "#8696ad" },
              { key: "Group", label: "Group", stackId: "u", color: "#376488" },
            ]}
          />
        </ChartCard>
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.product_id} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} emptyMessage="No sales in this period." />
      <p className="mt-2 text-xs text-ink-muted">Total across table: {moneyCompact(totalRevenue)}</p>
    </>
  );
}
