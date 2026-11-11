"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { CheckCircle2, XCircle } from "lucide-react";
import { API_URL, ADMIN_ROLES } from "@/lib/api";
import { dateTime } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useAdminAuth } from "@/providers/AdminAuthProvider";

export default function SettingsPage() {
  const { user, logout } = useAdminAuth();
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async () => (await axios.get<{ status: string; app: string; version: string }>(`${API_URL}/health`)).data,
    refetchInterval: 60_000,
  });

  const rows: [string, React.ReactNode][] = [
    ["Name", user ? `${user.first_name} ${user.last_name}` : "—"],
    ["Email", user?.email ?? "—"],
    ["Roles", <div key="r" className="flex gap-1">{user?.roles.map((r) => <StatusBadge key={r.id} value={r.name === "staff" ? "pending" : "group"} label={r.name} />)}</div>],
    ["Last login", dateTime(user?.last_login_at)],
  ];

  return (
    <>
      <PageHeader title="Settings" description="Your session and environment" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-muted">Account</h2>
          <dl className="divide-y divide-slate-100 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between py-2.5"><dt className="text-ink-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
          <button className="btn-secondary mt-5" onClick={logout}>Sign out</button>
        </section>
        <section className="panel p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-muted">Environment</h2>
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="flex justify-between py-2.5"><dt className="text-ink-muted">API URL</dt><dd className="font-mono text-xs">{API_URL}</dd></div>
            <div className="flex justify-between py-2.5">
              <dt className="text-ink-muted">API health</dt>
              <dd className="flex items-center gap-1.5 font-medium">
                {health.isLoading ? "Checking…" : health.data?.status === "ok" ? (<><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Online · v{health.data.version}</>) : (<><XCircle className="h-4 w-4 text-red-600" /> Unreachable</>)}
              </dd>
            </div>
            <div className="flex justify-between py-2.5"><dt className="text-ink-muted">Permitted roles</dt><dd className="font-mono text-xs">{ADMIN_ROLES.join(", ")}</dd></div>
            <div className="flex justify-between py-2.5"><dt className="text-ink-muted">Token storage</dt><dd className="font-mono text-xs">localStorage: admin_access_token</dd></div>
          </dl>
        </section>
      </div>
    </>
  );
}
