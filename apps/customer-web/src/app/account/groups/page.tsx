"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { customerApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { GroupCard } from "@/components/GroupCard";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";

const FILTERS = [
  { value: "", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "SUCCESSFUL", label: "Successful" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function AccountGroupsPage() {
  const [status, setStatus] = useState("");
  const groups = useQuery({
    queryKey: ["customer-groups", status],
    queryFn: () => customerApi.groups(status || undefined),
  });

  return (
    <div>
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" onClick={() => setStatus(f.value)} className={cn("chip shrink-0", status === f.value && "chip-active")}>
            {f.label}
          </button>
        ))}
      </div>

      {groups.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : groups.isError ? (
        <ErrorState message="We couldn't load your groups." onRetry={() => groups.refetch()} />
      ) : groups.data!.length === 0 ? (
        <EmptyState icon={Users} title="No groups here" description="Groups you start or join will appear here." actionHref="/groups" actionLabel="Browse open groups" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{groups.data!.map((g) => <GroupCard key={g.id} group={g} />)}</div>
      )}
    </div>
  );
}
