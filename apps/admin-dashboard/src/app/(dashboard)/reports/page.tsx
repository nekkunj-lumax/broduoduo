"use client";

import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi, downloadBlob, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { useDateRange } from "@/providers/DateRangeProvider";

export default function ReportsPage() {
  const { range } = useDateRange();
  const m = useMutation({
    mutationFn: () => adminApi.salesCsv(range),
    onSuccess: (blob) => {
      downloadBlob(blob, `sales_report_${range.start}_to_${range.end}.csv`);
      toast.success(`Report exported at ${format(new Date(), "HH:mm:ss")}`);
    },
    onError: (e) => toast.error(errorMessage(e, "Export failed")),
  });

  return (
    <>
      <PageHeader title="Reports" description="Export data for finance and external analysis" actions={<DateRangeFilter />} />
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-steel-100 text-steel-700"><FileSpreadsheet className="h-5 w-5" /></span>
          <div>
            <h2 className="font-semibold">Product sales report (CSV)</h2>
            <p className="max-w-xl text-sm text-ink-muted">
              Per-product units and revenue split by individual and group purchases for {range.start} to {range.end}.
              Columns: product_id, name, sku, prices, units_sold, revenue, individual_units, group_units.
            </p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => m.mutate()} disabled={m.isPending}>
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download CSV
        </button>
      </div>
    </>
  );
}
