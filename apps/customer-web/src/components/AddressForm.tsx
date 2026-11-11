"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { customerApi, getErrorMessage, type Address } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/States";

const schema = z.object({
  label: z.string().min(1, "Required").max(50),
  recipient_name: z.string().min(2, "Required"),
  phone: z.string().min(6, "Enter a valid phone"),
  line1: z.string().min(3, "Required"),
  line2: z.string().optional(),
  city: z.string().min(2, "Required"),
  state: z.string().min(2, "Required"),
  postal_code: z.string().min(3, "Required"),
  country: z.string().length(2, "Use 2-letter code (e.g. US)"),
  is_default: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function AddressForm({ onCreated, onCancel }: { onCreated?: (a: Address) => void; onCancel?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: "Home",
      recipient_name: user ? `${user.first_name} ${user.last_name}` : "",
      phone: user?.phone ?? "",
      country: "US",
      is_default: true,
    },
  });

  const mutation = useMutation({
    mutationFn: (v: FormValues) => customerApi.createAddress({ ...v, line2: v.line2 || null }),
    onSuccess: (address) => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Address saved");
      onCreated?.(address);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Label" error={errors.label?.message}>
        <input className="input" {...register("label")} />
      </Field>
      <Field label="Recipient" error={errors.recipient_name?.message}>
        <input className="input" autoComplete="name" {...register("recipient_name")} />
      </Field>
      <Field label="Phone" error={errors.phone?.message}>
        <input className="input" type="tel" autoComplete="tel" {...register("phone")} />
      </Field>
      <Field label="Address line 1" error={errors.line1?.message}>
        <input className="input" autoComplete="address-line1" {...register("line1")} />
      </Field>
      <Field label="Address line 2 (optional)" error={errors.line2?.message}>
        <input className="input" autoComplete="address-line2" {...register("line2")} />
      </Field>
      <Field label="City" error={errors.city?.message}>
        <input className="input" autoComplete="address-level2" {...register("city")} />
      </Field>
      <Field label="State / Region" error={errors.state?.message}>
        <input className="input" autoComplete="address-level1" {...register("state")} />
      </Field>
      <Field label="Postal code" error={errors.postal_code?.message}>
        <input className="input" autoComplete="postal-code" {...register("postal_code")} />
      </Field>
      <Field label="Country (2-letter)" error={errors.country?.message}>
        <input className="input uppercase" maxLength={2} autoComplete="country" {...register("country")} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink-600 sm:col-span-2">
        <input type="checkbox" className="h-4 w-4 accent-brand-500" {...register("is_default")} />
        Use as my default address
      </label>
      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending && <Spinner className="h-4 w-4 text-white" />} Save address
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
