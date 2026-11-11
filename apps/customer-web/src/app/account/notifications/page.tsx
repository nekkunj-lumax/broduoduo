"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { customerApi, getErrorMessage, type AppNotification } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";

function hrefFor(n: AppNotification): string | null {
  if (!n.reference_id) return null;
  switch (n.reference_type) {
    case "group":
    case "buying_group":
      return `/groups/${n.reference_id}`;
    case "order":
      return "/account/orders";
    default:
      return null;
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["notifications", "all"], queryFn: () => customerApi.notifications(false) });

  const markRead = useMutation({
    mutationFn: (id: string) => customerApi.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const unread = (list.data ?? []).filter((n) => !n.is_read);
      await Promise.all(unread.map((n) => customerApi.markNotificationRead(n.id)));
    },
    onSuccess: () => {
      toast.success("All caught up");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (list.isLoading) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>;
  if (list.isError) return <ErrorState message="We couldn't load notifications." onRetry={() => list.refetch()} />;
  if (list.data!.length === 0)
    return <EmptyState icon={Bell} title="No notifications" description="We'll let you know when your groups fill up or orders ship." />;

  const unreadCount = list.data!.filter((n) => !n.is_read).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-500">{unreadCount} unread</p>
        {unreadCount > 0 && (
          <button type="button" onClick={() => markAll.mutate()} disabled={markAll.isPending} className="btn-secondary !py-2">
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        )}
      </div>
      <ul className="space-y-2">
        {list.data!.map((n) => {
          const href = hrefFor(n);
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  if (!n.is_read) markRead.mutate(n.id);
                  if (href) router.push(href);
                }}
                className={cn(
                  "card flex w-full items-start gap-3 p-4 text-left transition hover:border-brand-300",
                  !n.is_read && "border-brand-300 bg-brand-50/60",
                )}
              >
                <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", n.is_read ? "bg-transparent" : "bg-brand-500")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-800">{n.title}</span>
                  <span className="mt-0.5 block text-sm text-ink-600">{n.body}</span>
                  <span className="mt-1 block text-xs text-ink-400">{timeAgo(n.created_at)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
