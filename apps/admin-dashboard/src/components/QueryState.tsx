import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { errorMessage } from "@/lib/api";

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="panel flex items-start gap-3 border-l-4 border-red-500 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-ink">Unable to load data</p>
        <p className="text-sm text-ink-muted">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <button className="btn-secondary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyBlock({ message = "No data for this selection." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-ink-muted">
      <Inbox className="h-6 w-6 text-ink-faint" />
      {message}
    </div>
  );
}
