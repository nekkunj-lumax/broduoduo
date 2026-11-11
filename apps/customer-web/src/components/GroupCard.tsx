import Link from "next/link";
import type { Group } from "@/lib/api";
import { formatMoney, statusTone, cn } from "@/lib/utils";
import { ProductImage } from "@/components/ProductImage";
import { GroupProgress } from "@/components/GroupProgress";
import { CountdownTimer } from "@/components/CountdownTimer";

export function GroupCard({ group }: { group: Group }) {
  const open = group.status === "OPEN";
  return (
    <Link
      href={`/groups/${group.id}`}
      className="card group flex gap-4 p-3.5 transition hover:-translate-y-0.5 sm:p-4"
    >
      <ProductImage
        src={group.product?.primary_image_url}
        alt={group.product?.name ?? "Group product"}
        className="h-24 w-24 shrink-0 rounded-2xl sm:h-28 sm:w-28"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold text-ink-800 sm:text-base">
            {group.product?.name ?? "Group buy"}
          </h3>
          {open ? (
            <CountdownTimer expiresAt={group.expires_at} compact className="shrink-0" />
          ) : (
            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1", statusTone(group.status))}>
              {group.status}
            </span>
          )}
        </div>
        <GroupProgress
          size="sm"
          confirmed={group.confirmed_participants}
          required={group.required_participants}
          status={group.status}
        />
        <div className="mt-auto flex items-center justify-between">
          <span className="font-display text-lg font-semibold text-brand-600">
            {formatMoney(group.group_price, group.currency)}
          </span>
          <span className="text-xs font-semibold text-brand-600 group-hover:underline">
            {open ? "View & join →" : "View details →"}
          </span>
        </div>
      </div>
    </Link>
  );
}
