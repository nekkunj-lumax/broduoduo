import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNowStrict, isValid } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Backend serialises Decimals as strings; normalise to number. */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(value: string | number | null | undefined, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(toNumber(value));
}

export function formatDate(value: string | Date | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return isValid(d) ? format(d, pattern) : "—";
}

export function timeAgo(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return isValid(d) ? `${formatDistanceToNowStrict(d)} ago` : "";
}

export function savingsPercent(individual: string | number, group: string | number): number {
  const i = toNumber(individual);
  const g = toNumber(group);
  if (i <= 0 || g >= i) return 0;
  return Math.round(((i - g) / i) * 100);
}

export function newIdempotencyKey(prefix = "pd"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${rand}`;
}

export function initials(first?: string, last?: string): string {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "P";
}

export function statusTone(status: string): string {
  switch (status.toUpperCase()) {
    case "PAID":
    case "SUCCESSFUL":
    case "DELIVERED":
    case "OPEN":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "PENDING":
    case "PROCESSING":
    case "SHIPPED":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "CANCELLED":
    case "EXPIRED":
    case "REFUNDED":
    case "FAILED":
      return "bg-stone-100 text-stone-600 ring-stone-200";
    default:
      return "bg-brand-50 text-brand-700 ring-brand-200";
  }
}
