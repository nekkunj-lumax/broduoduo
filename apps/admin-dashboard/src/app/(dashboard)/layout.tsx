"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { useAdminAuth } from "@/providers/AdminAuthProvider";
import { DateRangeProvider } from "@/providers/DateRangeProvider";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAdminAuth();

  // Login redirect disabled for local demo — auto-login supplies the session.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-ink-muted">
        Could not auto-sign in. Is the API running on http://localhost:8000?
      </div>
    );
  }

  return (
    <DateRangeProvider>
      <Sidebar />
      <main className="ml-64 min-h-screen px-8 py-7">
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>
    </DateRangeProvider>
  );
}
