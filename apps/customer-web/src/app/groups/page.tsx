"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { groupsApi } from "@/lib/api";
import { GroupCard } from "@/components/GroupCard";
import { EmptyState, ErrorState, Skeleton, Spinner } from "@/components/States";

export default function GroupsPage() {
  const groups = useInfiniteQuery({
    queryKey: ["groups", "open"],
    queryFn: ({ pageParam }) => groupsApi.list({ page: pageParam, page_size: 12 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    refetchInterval: 30_000,
  });
  const items = groups.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-ink-800 sm:text-4xl">Open groups</h1>
        <p className="mt-1 text-sm text-ink-500">Join a group before the timer runs out and unlock the group price.</p>
      </div>

      {groups.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : groups.isError ? (
        <ErrorState message="We couldn't load groups." onRetry={() => groups.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No open groups yet"
          description="Pick a product and start the first group — then share the link with friends."
          actionHref="/products?group_buy_only=true"
          actionLabel="Find group deals"
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((g) => <GroupCard key={g.id} group={g} />)}
          </div>
          {groups.hasNextPage && (
            <div className="mt-8 flex justify-center">
              <button type="button" className="btn-secondary" disabled={groups.isFetchingNextPage} onClick={() => groups.fetchNextPage()}>
                {groups.isFetchingNextPage && <Spinner className="h-4 w-4" />} Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
