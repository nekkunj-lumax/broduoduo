"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/States";

const schema = z
  .object({
    first_name: z.string().min(1, "Required").max(100),
    last_name: z.string().min(1, "Required").max(100),
    email: z.string().email("Enter a valid email"),
    phone: z.string().optional(),
    password: z.string().min(8, "At least 8 characters").max(128),
    confirm: z.string(),
    referral_code: z.string().optional(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
type Values = z.infer<typeof schema>;

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const { register: signUp, user, loading } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { referral_code: params.get("ref") ?? "" },
  });

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  async function onSubmit(v: Values) {
    setFormError(null);
    try {
      const u = await signUp({
        email: v.email,
        password: v.password,
        first_name: v.first_name,
        last_name: v.last_name,
        phone: v.phone || undefined,
        referral_code: v.referral_code || undefined,
      });
      toast.success(`Welcome to Brodoudou, ${u.first_name}!`);
      router.replace(next);
    } catch (e) {
      setFormError(getErrorMessage(e));
    }
  }

  const err = (m?: string) => (m ? <p className="mt-1 text-xs text-red-600">{m}</p> : null);

  return (
    <div className="mx-auto max-w-lg py-6">
      <div className="card p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold text-ink-800">Join Brodoudou</h1>
        <p className="mt-1 text-sm text-ink-500">Create an account to start or join group buys.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-4 sm:grid-cols-2" noValidate>
          {formError && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2">
              {formError}
            </p>
          )}
          <div>
            <label htmlFor="first_name" className="label">First name</label>
            <input id="first_name" autoComplete="given-name" className="input" {...register("first_name")} />
            {err(errors.first_name?.message)}
          </div>
          <div>
            <label htmlFor="last_name" className="label">Last name</label>
            <input id="last_name" autoComplete="family-name" className="input" {...register("last_name")} />
            {err(errors.last_name?.message)}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="email" className="label">Email</label>
            <input id="email" type="email" autoComplete="email" className="input" {...register("email")} />
            {err(errors.email?.message)}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="phone" className="label">Phone (optional)</label>
            <input id="phone" type="tel" autoComplete="tel" className="input" {...register("phone")} />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input id="password" type="password" autoComplete="new-password" className="input" {...register("password")} />
            {err(errors.password?.message)}
          </div>
          <div>
            <label htmlFor="confirm" className="label">Confirm password</label>
            <input id="confirm" type="password" autoComplete="new-password" className="input" {...register("confirm")} />
            {err(errors.confirm?.message)}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="referral_code" className="label">Referral code (optional)</label>
            <input id="referral_code" className="input" {...register("referral_code")} />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg sm:col-span-2">
            {isSubmitting && <Spinner className="h-5 w-5 text-white" />} Create account
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
