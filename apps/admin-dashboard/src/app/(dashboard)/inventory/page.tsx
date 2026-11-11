"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { adminApi, errorMessage } from "@/lib/api";
import type { InventoryRow } from "@/lib/types";
import { int } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { KpiCard } from "@/components/KpiCard";

const schema = z.object({
  quantity_delta: z
    .number({ message: "Enter a number" })
    .int("Must be a whole number")
    .refine((v) => v !== 0, "Cannot be zero"),
  notes: z.string().trim().min(3, "Add a reason (min 3 characters)").max(255),
});
type FormValues = z.infer<typeof schema>;

function AdjustDialog({ row, onClose }: { row: InventoryRow; onClose: () => void }) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { notes: "" } });
  const delta = Number(watch("quantity_delta")) || 0;

  const m = useMutation({
    mutationFn: (v: FormValues) =>
      adminApi.adjustInventory({ product_id: row.product_id, quantity_delta: v.quantity_delta, notes: v.notes }),
    onSuccess: (res) => {
      toast.success(`${row.name}: available stock is now ${res.available_qty}`);
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["audit-logs"] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e, "Adjustment failed")),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-steel-950/50 p-4" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit((v) => m.mutate(v))} className="panel w-full max-w-md space-y-4 p-6" noValidate>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Adjust stock</h2>
            <p className="text-sm text-ink-muted">{row.name} · <span className="font-mono">{row.sku}</span></p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-ink-muted hover:bg-slate-100" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
          Available <strong>{int(row.available_qty)}</strong>
          {delta !== 0 && <> → <strong className={delta > 0 ? "text-emerald-700" : "text-red-700"}>{int(row.available_qty + delta)}</strong></>}
        </div>
        <div>
          <label className="label" htmlFor="qd">Quantity change</label>
          <input id="qd" type="number" step={1} className="input" placeholder="e.g. 50 or -5" {...register("quantity_delta", { valueAsNumber: true })} />
          {errors.quantity_delta && <p className="mt-1 text-xs text-red-600">{errors.quantity_delta.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="notes">Reason</label>
          <textarea id="notes" rows={3} className="input" placeholder="Restock from supplier, damaged goods, recount…" {...register("notes")} />
          {errors.notes && <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={m.isPending}>
            {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Apply adjustment
          </button>
        </div>
      </form>
    </div>
  );
}

export default function InventoryPage() {
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const q = useQuery({ queryKey: ["inventory"], queryFn: adminApi.inventory });
  const rows = q.data ?? [];
  const low = rows.filter((r) => r.is_low_stock).length;

  const columns: Column<InventoryRow>[] = [
    { key: "name", header: "Product", sortValue: (r) => r.name ?? "", cell: (r) => <div><p className="font-medium">{r.name}</p><p className="font-mono text-xs text-ink-muted">{r.sku}</p></div> },
    { key: "avail", header: "Available", align: "right", sortValue: (r) => r.available_qty, cell: (r) => <span className="font-semibold">{int(r.available_qty)}</span> },
    { key: "res", header: "Reserved", align: "right", sortValue: (r) => r.reserved_qty, cell: (r) => int(r.reserved_qty) },
    { key: "sold", header: "Sold", align: "right", sortValue: (r) => r.sold_qty, cell: (r) => int(r.sold_qty) },
    { key: "thr", header: "Low-stock threshold", align: "right", cell: (r) => int(r.low_stock_threshold) },
    { key: "state", header: "Status", cell: (r) => <StatusBadge value={r.is_low_stock ? "low" : "ok"} label={r.is_low_stock ? "Low stock" : "Healthy"} /> },
    { key: "act", header: "", align: "right", cell: (r) => <button className="btn-secondary !py-1" onClick={() => setEditing(r)}><SlidersHorizontal className="h-3.5 w-3.5" /> Adjust</button> },
  ];

  return (
    <>
      <PageHeader title="Inventory" description="Stock levels and manual adjustments (audited)" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard loading={q.isLoading} label="Tracked products" value={int(rows.length)} />
        <KpiCard loading={q.isLoading} tone="red" label="Low stock" value={int(low)} />
        <KpiCard loading={q.isLoading} tone="amber" label="Units reserved" value={int(rows.reduce((s, r) => s + r.reserved_qty, 0))} />
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.product_id} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} />
      {editing && <AdjustDialog row={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
