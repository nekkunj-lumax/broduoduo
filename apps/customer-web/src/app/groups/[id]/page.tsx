"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { CheckCircle2, Clock, Copy, Share2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { WS_URL, getErrorMessage, groupsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { cn, formatMoney, initials, savingsPercent, statusTone, timeAgo } from "@/lib/utils";
import { CountdownTimer } from "@/components/CountdownTimer";
import { GroupProgress } from "@/components/GroupProgress";
import { ProductImage } from "@/components/ProductImage";
import { EmptyState, ErrorState, Skeleton, Spinner } from "@/components/States";

function GroupDetailContent() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const invite = search.get("invite") ?? undefined;
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const cart = useCart();
  const [now, setNow] = useState(0);

  const group = useQuery({
    queryKey: ["group", id],
    queryFn: () => groupsApi.get(id),
    refetchInterval: 15_000,
    enabled: !!id,
  });

  // Live updates: any server broadcast for this group triggers a refetch.
  useEffect(() => {
    if (!id) return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(`${WS_URL}/ws/groups/${id}`);
      ws.onmessage = () => qc.invalidateQueries({ queryKey: ["group", id] });
    } catch {
      // polling fallback above still keeps data fresh
    }
    return () => ws?.close();
  }, [id, qc]);

  useEffect(() => setNow(Date.now()), [group.dataUpdatedAt]);

  const onExpire = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["group", id] });
  }, [qc, id]);

  const cancel = useMutation({
    mutationFn: () => groupsApi.cancel(id),
    onSuccess: () => {
      toast.success("Group cancelled");
      qc.invalidateQueries({ queryKey: ["group", id] });
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (group.isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="aspect-square" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (group.isError || !group.data) {
    const notFound = isAxiosError(group.error) && group.error.response?.status === 404;
    return notFound ? (
      <EmptyState icon={UsersRound} title="Group not found" actionHref="/groups" actionLabel="Browse groups" />
    ) : (
      <ErrorState message={getErrorMessage(group.error, "We couldn't load this group.")} onRetry={() => group.refetch()} />
    );
  }

  const g = group.data;
  const product = g.product;
  const open = g.status === "OPEN" && (now === 0 || new Date(g.expires_at).getTime() > now);
  const me = user ? g.participants.find((p) => p.user_id === user.id) : undefined;
  const isCreator = !!user && user.id === g.creator_id;
  const full = g.confirmed_participants + g.pending_participants >= g.required_participants;
  const off = product ? savingsPercent(product.individual_price, g.group_price) : 0;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/groups/${g.id}?invite=${g.invite_code}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy — long-press the link to copy it manually.");
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: `Join my Brodoudou group for ${product?.name ?? "a deal"}`,
        text: `Join my group and we both get ${formatMoney(g.group_price, g.currency)}!`,
        url: shareUrl,
      });
    } catch {
      /* user dismissed */
    }
  }

  function joinGroup() {
    if (!product) return;
    cart.add({ mode: "group_join", product, groupId: g.id, inviteCode: invite });
    toast.success("Added to your cart");
    router.push("/cart");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-5 lg:gap-12">
      <div className="lg:col-span-2">
        <Link href={product ? `/products/${product.id}` : "/products"}>
          <ProductImage src={product?.primary_image_url} alt={product?.name ?? "Product"} className="aspect-square w-full rounded-3xl shadow-soft" />
        </Link>
      </div>

      <div className="space-y-6 lg:col-span-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold ring-1", statusTone(g.status))}>{g.status}</span>
            {g.creator_name && <span className="text-sm text-ink-500">Started by {g.creator_name}</span>}
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-ink-800 sm:text-4xl">
            {product?.name ?? "Group buy"}
          </h1>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <span className="font-display text-3xl font-semibold text-brand-600">{formatMoney(g.group_price, g.currency)}</span>
            {product && <span className="text-ink-400 line-through">{formatMoney(product.individual_price, g.currency)}</span>}
            {off > 0 && <span className="rounded-full bg-brand-500 px-2.5 py-1 text-xs font-bold text-white">Save {off}%</span>}
          </div>
        </div>

        <div className="card space-y-5 p-5">
          <GroupProgress
            confirmed={g.confirmed_participants}
            required={g.required_participants}
            pending={g.pending_participants}
            status={g.status}
          />
          {g.status === "OPEN" && (
            <div>
              <p className="label flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Time left</p>
              <CountdownTimer expiresAt={g.expires_at} onExpire={onExpire} />
            </div>
          )}
          {g.status === "SUCCESSFUL" && (
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
              <CheckCircle2 className="h-5 w-5" /> This group is complete — orders are being processed.
            </p>
          )}
          {(g.status === "EXPIRED" || g.status === "CANCELLED") && (
            <p className="text-sm text-ink-500">This group is {g.status.toLowerCase()}. Paid participants are refunded.</p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {open && !me && !full && (
            <button type="button" onClick={joinGroup} className="btn-primary btn-lg w-full">
              Join this group · {formatMoney(g.group_price, g.currency)}
            </button>
          )}
          {open && !me && full && (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              All spots are reserved right now. Check back in case a spot frees up, or{" "}
              <Link href={product ? `/products/${product.id}` : "/products"} className="font-semibold underline">start your own group</Link>.
            </p>
          )}
          {me && (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <p className="font-semibold">
                {me.payment_status === "paid" ? "You're in this group 🎉" : `Your spot is ${me.payment_status}.`}
              </p>
              {me.payment_status === "pending" && (
                <p className="mt-0.5">
                  Complete payment from{" "}
                  <Link href="/account/orders" className="font-semibold underline">your orders</Link> to lock it in.
                </p>
              )}
            </div>
          )}
          {!user && open && (
            <p className="text-center text-xs text-ink-500">
              You&apos;ll be asked to <Link href={`/login?next=${encodeURIComponent(`/groups/${id}`)}`} className="font-semibold text-brand-600 underline">log in</Link> at checkout.
            </p>
          )}

          {g.status === "OPEN" && (
            <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="label !mb-1">Invite friends</p>
                <p className="truncate rounded-xl bg-brand-50 px-3 py-2 text-xs text-ink-600">{shareUrl}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={copyLink} className="btn-secondary !px-4">
                  <Copy className="h-4 w-4" /> Copy
                </button>
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <button type="button" onClick={share} className="btn-primary !px-4">
                    <Share2 className="h-4 w-4" /> Share
                  </button>
                )}
              </div>
            </div>
          )}

          {isCreator && g.status === "OPEN" && g.confirmed_participants === 0 && (
            <button
              type="button"
              disabled={cancel.isPending}
              onClick={() => {
                if (window.confirm("Cancel this group? Pending orders will be cancelled.")) cancel.mutate();
              }}
              className="btn-ghost w-full !text-red-600 hover:!bg-red-50"
            >
              {cancel.isPending && <Spinner className="h-4 w-4" />} Cancel group
            </button>
          )}
        </div>

        {/* Participants */}
        <div>
          <h2 className="mb-3 font-display text-xl font-semibold text-ink-800">Who&apos;s in</h2>
          {g.participants.length === 0 ? (
            <p className="text-sm text-ink-500">No participants yet.</p>
          ) : (
            <ul className="space-y-2">
              {g.participants.map((p) => (
                <li key={p.id} className="card flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-300 to-brand-500 text-xs font-bold text-white">
                    {initials(p.user_first_name ?? "", p.user_last_name ?? "")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-800">
                      {p.user_first_name} {p.user_last_name}
                      {user?.id === p.user_id && <span className="ml-1.5 text-xs font-medium text-brand-600">(you)</span>}
                    </p>
                    <p className="text-xs text-ink-500">Joined {timeAgo(p.created_at)}</p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1", statusTone(p.payment_status === "paid" ? "PAID" : p.payment_status === "pending" ? "PENDING" : "FAILED"))}>
                    {p.payment_status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GroupDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <GroupDetailContent />
    </Suspense>
  );
}
