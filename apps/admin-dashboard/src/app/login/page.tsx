"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, LockKeyhole, ShieldCheck, BarChart3, UsersRound } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { NotAdminError, useAdminAuth } from "@/providers/AdminAuthProvider";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { user, loading, login } = useAdminAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!loading && user) router.replace("/overview");
  }, [loading, user, router]);

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await login(values.email, values.password);
      router.replace("/overview");
    } catch (err) {
      setFormError(err instanceof NotAdminError ? err.message : errorMessage(err, "Sign in failed"));
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between bg-steel-950 p-12 text-slate-300 lg:flex">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-steel-300">Brodoudou</p>
          <h1 className="mt-6 max-w-md text-4xl font-semibold leading-tight text-white">
            Business intelligence for group-buying operations.
          </h1>
          <p className="mt-4 max-w-md text-steel-200/80">
            Monitor revenue, group success rates, orders and inventory from one console.
          </p>
        </div>
        <ul className="space-y-4 text-sm">
          {[
            [BarChart3, "Live KPIs computed directly from the order ledger"],
            [UsersRound, "Group lifecycle and conversion analytics"],
            [ShieldCheck, "Role-gated access with audit logging"],
          ].map(([Icon, text], i) => {
            const I = Icon as typeof BarChart3;
            return (
              <li key={i} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-steel-300">
                  <I className="h-4 w-4" />
                </span>
                {text as string}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center justify-center bg-canvas p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="panel w-full max-w-sm space-y-5 p-8" noValidate>
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-steel-700 text-white">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-ink">Admin sign in</h2>
            <p className="text-sm text-ink-muted">Restricted to admin, owner and staff accounts.</p>
          </div>

          {formError && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" className="input" {...register("email")} />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" className="input" {...register("password")} />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
