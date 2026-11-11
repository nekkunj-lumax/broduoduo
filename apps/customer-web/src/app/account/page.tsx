"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, LogOut, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { customerApi, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { AddressForm } from "@/components/AddressForm";
import { ErrorState, Skeleton, Spinner } from "@/components/States";

const schema = z.object({
  first_name: z.string().min(1, "Required").max(100),
  last_name: z.string().min(1, "Required").max(100),
  phone: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export default function AccountProfilePage() {
  const { user, setUser, logout } = useAuth();
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  const addresses = useQuery({ queryKey: ["addresses"], queryFn: customerApi.addresses });

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { first_name: user?.first_name, last_name: user?.last_name, phone: user?.phone ?? "" },
  });

  const update = useMutation({
    mutationFn: (v: Values) => customerApi.updateProfile({ ...v, phone: v.phone || undefined }),
    onSuccess: (u) => {
      setUser(u);
      reset({ first_name: u.first_name, last_name: u.last_name, phone: u.phone ?? "" });
      toast.success("Profile updated");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (!user) return null;

  async function copyReferral() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/register?ref=${user!.referral_code}`);
      toast.success("Referral link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 font-display text-xl font-semibold text-ink-800">Profile</h2>
        <form onSubmit={handleSubmit((v) => update.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div>
            <label htmlFor="first_name" className="label">First name</label>
            <input id="first_name" className="input" {...register("first_name")} />
            {errors.first_name && <p className="mt-1 text-xs text-red-600">{errors.first_name.message}</p>}
          </div>
          <div>
            <label htmlFor="last_name" className="label">Last name</label>
            <input id="last_name" className="input" {...register("last_name")} />
            {errors.last_name && <p className="mt-1 text-xs text-red-600">{errors.last_name.message}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="label">Email</label>
            <input className="input bg-brand-50/50" value={user.email} readOnly disabled />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="phone" className="label">Phone</label>
            <input id="phone" type="tel" className="input" {...register("phone")} />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" disabled={!isDirty || update.isPending} className="btn-primary">
              {update.isPending && <Spinner className="h-4 w-4 text-white" />} Save changes
            </button>
            <span className="text-xs text-ink-500">Member since {formatDate(user.created_at)}</span>
          </div>
        </form>
      </section>

      <div className="space-y-6">
        <section className="card p-5 sm:p-6">
          <h2 className="mb-1 font-display text-xl font-semibold text-ink-800">Invite friends</h2>
          <p className="mb-4 text-sm text-ink-500">Share your referral link. Your code:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-2xl bg-brand-50 px-4 py-2.5 font-mono text-sm font-semibold text-brand-700">
              {user.referral_code}
            </code>
            <button type="button" onClick={copyReferral} className="btn-secondary">
              <Copy className="h-4 w-4" /> Copy link
            </button>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink-800">
              <MapPin className="h-5 w-5 text-brand-500" /> Addresses
            </h2>
            {!adding && (
              <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
                <Plus className="h-4 w-4" /> Add
              </button>
            )}
          </div>
          {adding && <div className="mb-5"><AddressForm onCreated={() => setAdding(false)} onCancel={() => setAdding(false)} /></div>}
          {addresses.isLoading ? (
            <Skeleton className="h-20" />
          ) : addresses.isError ? (
            <ErrorState message="We couldn't load your addresses." onRetry={() => addresses.refetch()} />
          ) : addresses.data!.length === 0 && !adding ? (
            <p className="text-sm text-ink-500">No saved addresses yet.</p>
          ) : (
            <ul className="space-y-3">
              {addresses.data!.map((a) => (
                <li key={a.id} className="rounded-2xl border border-brand-100 p-3.5 text-sm">
                  <p className="flex items-center gap-2 font-semibold text-ink-800">
                    {a.label}
                    {a.is_default && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700">Default</span>}
                  </p>
                  <p className="text-ink-600">{a.recipient_name} · {a.phone}</p>
                  <p className="text-ink-500">
                    {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.postal_code}, {a.country}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <button
          type="button"
          onClick={async () => {
            await logout();
            toast.success("Signed out");
            router.push("/");
          }}
          className="btn-secondary w-full"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
