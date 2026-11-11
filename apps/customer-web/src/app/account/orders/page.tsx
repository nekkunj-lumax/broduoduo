"use client";

import Link from "next/link";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Package } from "lucide-react";
import { toast } from "sonner";
import { customerApi, getErrorMessage, paymentsApi, type Order } from "@/lib/api";
import { formatDate, formatMoney, newIdempotencyKey } from "@/lib/utils";
import { EmptyState, ErrorState, Skeleton, Spinner, StatusBadge } from "@/components/States";

function OrderCard({ order }: { order: Order }) {
  const qc = useQueryClient();
  const pay = useMutation({
    mutationFn: () => paymentsApi.create({ order_id: order.id, idempotency_key: newIdempotencyKey("pay") }),
    onSuccess: () => {
      toast.success("Payment successful");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["customer-groups"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold text-ink-800">#{order.order_number}</p>
          <p className="text-xs text-ink-500">
            Placed {formatDate(order.created_at)} · {order.purchase_type === "group" ? "Group buy" : "Solo purchase"}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <ul className="mt-3 divide-y divide-brand-100 text-sm">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3 py-2">
            <span className="min-w-0 truncate text-ink-700">
              {i.product_name} <span className="text-ink-400">× {i.quantity}</span>
            </span>
            <span className="font-semibold text-ink-800">{formatMoney(i.line_total, order.currency)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 pt-3">
        <p className="text-sm text-ink-500">
          Total <span className="ml-1 font-display text-lg font-semibold text-brand-600">{formatMoney(order.total_amount, order.currency)}</span>
        </p>
        <div className="flex gap-2">
          {order.buying_group_id && (
            <Link href={`/groups/${order.buying_group_id}`} className="btn-secondary !py-2">
              View group
            </Link>
          )}
          {order.status === "PENDING" && (
            <button type="button" onClick={() => pay.mutate()} disabled={pay.isPending} className="btn-primary !py-2">
              {pay.isPending ? <Spinner className="h-4 w-4 text-white" /> : <CreditCard className="h-4 w-4" />} Pay now
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export default function OrdersPage() {
  const orders = useInfiniteQuery({
    queryKey: ["orders"],
    queryFn: ({ pageParam }) => customerApi.orders({ page: pageParam, page_size: 10 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
  });
  const items = orders.data?.pages.flatMap((p) => p.items) ?? [];

  if (orders.isLoading) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>;
  if (orders.isError) return <ErrorState message="We couldn't load your orders." onRetry={() => orders.refetch()} />;
  if (items.length === 0)
    return <EmptyState icon={Package} title="No orders yet" description="Your orders will show up here." actionHref="/products" actionLabel="Start shopping" />;

  return (
    <>
      <ul className="space-y-3">{items.map((o) => <OrderCard key={o.id} order={o} />)}</ul>
      {orders.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <button type="button" className="btn-secondary" disabled={orders.isFetchingNextPage} onClick={() => orders.fetchNextPage()}>
            {orders.isFetchingNextPage && <Spinner className="h-4 w-4" />} Load more
          </button>
        </div>
      )}
    </>
  );
}
