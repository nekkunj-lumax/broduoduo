import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { endOfDay, startOfDay } from "date-fns";
import type {
  AdminUser,
  AuditLog,
  Customer,
  CustomerAnalytics,
  DateRange,
  Group,
  GroupAnalytics,
  GroupDetail,
  InventoryRow,
  Order,
  Overview,
  Paginated,
  Product,
  ProductSales,
  RevenueAnalytics,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(
  /\/$/,
  "",
);

export const ACCESS_TOKEN_KEY = "admin_access_token";
export const REFRESH_TOKEN_KEY = "admin_refresh_token";
export const ADMIN_ROLES = ["admin", "owner", "staff"] as const;

export const tokenStore = {
  get access(): string | null {
    return typeof window === "undefined" ? null : localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  get refresh(): string | null {
    return typeof window === "undefined" ? null : localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export const api = axios.create({ baseURL: API_URL, timeout: 30000 });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access;
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStore.refresh;
  if (!refresh) return null;
  try {
    const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refresh_token: refresh });
    tokenStore.set(data.access_token, data.refresh_token);
    return data.access_token as string;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const url = original?.url ?? "";
    if (error.response?.status === 401 && original && !original._retry && !url.includes("/auth/login")) {
      original._retry = true;
      refreshing = refreshing ?? refreshAccessToken().finally(() => (refreshing = null));
      const token = await refreshing;
      if (token) {
        original.headers.set("Authorization", `Bearer ${token}`);
        return api(original);
      }
      tokenStore.clear();
      // Login redirect disabled while demo auto-auth is enabled.
    }
    return Promise.reject(error);
  },
);

export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as { detail?: unknown; message?: string } | undefined;
    if (typeof d?.detail === "string") return d.detail;
    if (Array.isArray(d?.detail)) {
      return (d!.detail as { msg?: string }[]).map((x) => x.msg).filter(Boolean).join(", ") || fallback;
    }
    if (d?.message) return d.message;
    if (!err.response) return "Cannot reach the API server";
  }
  return err instanceof Error ? err.message : fallback;
}

/** Convert a yyyy-MM-dd range to ISO datetimes covering whole local days. */
export function rangeParams(r: DateRange) {
  return {
    start: startOfDay(new Date(`${r.start}T00:00:00`)).toISOString(),
    end: endOfDay(new Date(`${r.end}T00:00:00`)).toISOString(),
  };
}

export function hasAdminRole(user?: { roles?: { name: string }[] } | null): boolean {
  return !!user?.roles?.some((r) => (ADMIN_ROLES as readonly string[]).includes(r.name));
}

// ---------- Auth ----------
export async function loginRequest(email: string, password: string) {
  const { data } = await api.post<{
    user: AdminUser;
    tokens: { access_token: string; refresh_token: string };
  }>("/api/auth/login", { email, password });
  return data;
}

export async function fetchMe() {
  const { data } = await api.get<AdminUser>("/api/auth/me");
  return data;
}

// ---------- Analytics ----------
export const adminApi = {
  overview: async (r: DateRange) =>
    (await api.get<Overview>("/api/admin/analytics/overview", { params: rangeParams(r) })).data,
  sales: async (r: DateRange) =>
    (await api.get<ProductSales[]>("/api/admin/analytics/sales", { params: rangeParams(r) })).data,
  products: async (r: DateRange) =>
    (await api.get<ProductSales[]>("/api/admin/analytics/products", { params: rangeParams(r) })).data,
  groupAnalytics: async (r: DateRange) =>
    (await api.get<GroupAnalytics>("/api/admin/analytics/groups", { params: rangeParams(r) })).data,
  customerAnalytics: async (r: DateRange) =>
    (await api.get<CustomerAnalytics>("/api/admin/analytics/customers", { params: rangeParams(r) }))
      .data,
  revenue: async (r: DateRange) =>
    (await api.get<RevenueAnalytics>("/api/admin/analytics/revenue", { params: rangeParams(r) })).data,

  // ---------- Lists ----------
  groups: async (p: { status?: string; page: number; page_size?: number }) =>
    (await api.get<Paginated<Group>>("/api/admin/groups", { params: clean(p) })).data,
  group: async (id: string) => (await api.get<GroupDetail>(`/api/admin/groups/${id}`)).data,
  adminProducts: async (p: { page: number; page_size?: number }) =>
    (await api.get<Paginated<Product>>("/api/admin/products", { params: p })).data,
  orders: async (p: { status?: string; purchase_type?: string; page: number; page_size?: number }) =>
    (await api.get<Paginated<Order>>("/api/admin/orders", { params: clean(p) })).data,
  customers: async (p: { page: number; page_size?: number }) =>
    (await api.get<Paginated<Customer>>("/api/admin/customers", { params: p })).data,

  // ---------- Inventory ----------
  inventory: async () => (await api.get<{ items: InventoryRow[] }>("/api/admin/inventory")).data.items,
  adjustInventory: async (body: { product_id: string; quantity_delta: number; notes: string }) =>
    (
      await api.post<{ product_id: string; available_qty: number; reserved_qty: number }>(
        "/api/admin/inventory/adjust",
        body,
      )
    ).data,

  // ---------- Audit / reports ----------
  auditLogs: async (p: { page: number; page_size?: number }) =>
    (await api.get<AuditLog[]>("/api/admin/audit-logs", { params: p })).data,
  salesCsv: async (r: DateRange) =>
    (
      await api.get<Blob>("/api/admin/reports/sales.csv", {
        params: rangeParams(r),
        responseType: "blob",
      })
    ).data,
};

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== "" && v !== null),
  ) as Partial<T>;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
