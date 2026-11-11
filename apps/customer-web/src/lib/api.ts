import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || API_URL.replace(/^http/, "ws");

/* ------------------------------------------------------------------ */
/* Types (mirroring backend Pydantic schemas; Decimals arrive as strings) */
/* ------------------------------------------------------------------ */

export type Money = string | number;

export interface Role {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  referral_code: string;
  roles: Role[];
  created_at: string;
  last_login_at?: string | null;
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthResponse {
  user: User;
  tokens: Tokens;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ProductListItem {
  id: string;
  sku: string;
  name: string;
  slug: string;
  short_description: string;
  individual_price: Money;
  group_price: Money;
  discount_percentage: Money;
  currency: string;
  group_size: number;
  is_group_buy_enabled: boolean;
  is_featured: boolean;
  rating_avg: Money;
  rating_count: number;
  successful_groups_count: number;
  units_sold: number;
  category_id: string;
  primary_image_url?: string | null;
  available_qty?: number | null;
}

export interface ProductImage {
  id: string;
  url: string;
  alt_text?: string | null;
  sort_order: number;
  is_primary: boolean;
}

export interface ProductDetail extends ProductListItem {
  description: string;
  specifications?: string | null;
  group_expiration_hours: number;
  max_group_size: number;
  seller_name: string;
  shipping_info: string;
  images: ProductImage[];
  inventory?: {
    available_qty: number;
    reserved_qty: number;
    sold_qty: number;
    low_stock_threshold: number;
    is_low_stock: boolean;
  } | null;
  created_at: string;
}

export type ProductSort = "popular" | "price_asc" | "price_desc" | "newest" | "discount" | "rating";

export interface ProductQuery {
  q?: string;
  category_id?: string;
  min_price?: number;
  max_price?: number;
  group_buy_only?: boolean;
  featured?: boolean;
  sort?: ProductSort;
  page?: number;
  page_size?: number;
}

export type GroupStatus = "OPEN" | "SUCCESSFUL" | "EXPIRED" | "CANCELLED";

export interface Group {
  id: string;
  product_id: string;
  creator_id: string;
  required_participants: number;
  confirmed_participants: number;
  pending_participants: number;
  remaining_participants: number;
  progress_percent: number;
  group_price: Money;
  currency: string;
  status: GroupStatus | string;
  expires_at: string;
  completed_at?: string | null;
  invite_code: string;
  created_at: string;
  product?: ProductListItem | null;
  invite_url?: string | null;
}

export interface Participant {
  id: string;
  user_id: string;
  payment_status: string;
  quantity: number;
  amount: Money;
  joined_via_invite: boolean;
  confirmed_at?: string | null;
  created_at: string;
  user_first_name?: string | null;
  user_last_name?: string | null;
}

export interface GroupDetail extends Group {
  participants: Participant[];
  creator_name?: string | null;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  unit_price: Money;
  quantity: number;
  line_total: Money;
  purchase_type: string;
}

export interface Payment {
  id: string;
  provider: string;
  provider_payment_id?: string | null;
  amount: Money;
  currency: string;
  status: string;
  confirmed_at?: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  purchase_type: string;
  buying_group_id?: string | null;
  status: string;
  subtotal: Money;
  discount_amount: Money;
  shipping_amount: Money;
  tax_amount: Money;
  total_amount: Money;
  currency: string;
  paid_at?: string | null;
  created_at: string;
  items: OrderItem[];
  payments: Payment[];
}

export interface Address {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

export type AddressInput = Omit<Address, "id" | "line2"> & { line2?: string | null };

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
  reference_type?: string | null;
  reference_id?: string | null;
}

/* ------------------------------------------------------------------ */
/* Token storage                                                       */
/* ------------------------------------------------------------------ */

const ACCESS_KEY = "pindodo.access_token";
const REFRESH_KEY = "pindodo.refresh_token";
export const AUTH_LOGOUT_EVENT = "pindodo:logout";

const isBrowser = () => typeof window !== "undefined";

export const tokenStore = {
  getAccess: () => (isBrowser() ? window.localStorage.getItem(ACCESS_KEY) : null),
  getRefresh: () => (isBrowser() ? window.localStorage.getItem(REFRESH_KEY) : null),
  set(tokens: Pick<Tokens, "access_token" | "refresh_token">) {
    if (!isBrowser()) return;
    window.localStorage.setItem(ACCESS_KEY, tokens.access_token);
    window.localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  },
  clear() {
    if (!isBrowser()) return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

/* ------------------------------------------------------------------ */
/* Axios instance with JWT + refresh                                   */
/* ------------------------------------------------------------------ */

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;
  try {
    const { data } = await axios.post<Tokens>(`${API_URL}/api/auth/refresh`, {
      refresh_token: refresh,
    });
    tokenStore.set(data);
    return data.access_token;
  } catch {
    return null;
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const url = original?.url ?? "";
    const isAuthCall = url.includes("/api/auth/login") || url.includes("/api/auth/register") || url.includes("/api/auth/refresh");

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall && tokenStore.getRefresh()) {
      original._retried = true;
      refreshPromise = refreshPromise ?? refreshAccessToken().finally(() => (refreshPromise = null));
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.set("Authorization", `Bearer ${newToken}`);
        return api(original);
      }
      tokenStore.clear();
      if (isBrowser()) window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
    }
    return Promise.reject(error);
  },
);

/** Extract a human readable message from FastAPI / app errors. */
export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "Can't reach the Brodoudou server. Check your connection.";
    const detail = (error.response.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length) {
      const first = detail[0] as { msg?: string; loc?: (string | number)[] };
      const field = first.loc?.[first.loc.length - 1];
      return first.msg ? `${field ? `${field}: ` : ""}${first.msg}` : fallback;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/* ------------------------------------------------------------------ */
/* Endpoint functions                                                  */
/* ------------------------------------------------------------------ */

export const authApi = {
  login: (body: { email: string; password: string }) =>
    api.post<AuthResponse>("/api/auth/login", body).then((r) => r.data),
  register: (body: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    referral_code?: string;
  }) => api.post<AuthResponse>("/api/auth/register", body).then((r) => r.data),
  me: () => api.get<User>("/api/auth/me").then((r) => r.data),
  logout: () => api.post("/api/auth/logout").then((r) => r.data),
};

export const productsApi = {
  list: (params: ProductQuery = {}) =>
    api.get<Paginated<ProductListItem>>("/api/products", { params }).then((r) => r.data),
  get: (id: string) => api.get<ProductDetail>(`/api/products/${id}`).then((r) => r.data),
  categories: () => api.get<Category[]>("/api/products/categories").then((r) => r.data),
};

export const groupsApi = {
  list: (params: { product_id?: string; category_id?: string; page?: number; page_size?: number } = {}) =>
    api.get<Paginated<Group>>("/api/groups", { params }).then((r) => r.data),
  get: (id: string) => api.get<GroupDetail>(`/api/groups/${id}`).then((r) => r.data),
  create: (body: {
    product_id: string;
    quantity: number;
    address_id: string;
    required_participants?: number;
    promotion_code?: string;
    idempotency_key: string;
  }) => api.post<{ group: Group; order: Order }>("/api/groups", body).then((r) => r.data),
  join: (
    id: string,
    body: {
      quantity: number;
      address_id: string;
      invite_token?: string;
      promotion_code?: string;
      idempotency_key: string;
    },
  ) => api.post<{ group: Group; order: Order }>(`/api/groups/${id}/join`, body).then((r) => r.data),
  cancel: (id: string) => api.post<Group>(`/api/groups/${id}/cancel`).then((r) => r.data),
};

export const ordersApi = {
  create: (body: {
    product_id: string;
    quantity: number;
    address_id: string;
    promotion_code?: string;
    idempotency_key: string;
  }) => api.post<Order>("/api/orders", body).then((r) => r.data),
  get: (id: string) => api.get<Order>(`/api/orders/${id}`).then((r) => r.data),
};

export const paymentsApi = {
  create: (body: { order_id: string; idempotency_key: string }) =>
    api.post<Payment>("/api/payments/create", body).then((r) => r.data),
};

export const customerApi = {
  orders: (params: { page?: number; page_size?: number } = {}) =>
    api.get<Paginated<Order>>("/api/customers/orders", { params }).then((r) => r.data),
  groups: (status?: string) =>
    api.get<Group[]>("/api/customers/groups", { params: status ? { status } : {} }).then((r) => r.data),
  addresses: () => api.get<Address[]>("/api/customers/addresses").then((r) => r.data),
  createAddress: (body: AddressInput) => api.post<Address>("/api/customers/addresses", body).then((r) => r.data),
  updateProfile: (body: Partial<Pick<User, "first_name" | "last_name" | "phone">>) =>
    api.put<User>("/api/customers/profile", body).then((r) => r.data),
  notifications: (unreadOnly = false) =>
    api
      .get<AppNotification[]>("/api/customers/notifications", { params: { unread_only: unreadOnly } })
      .then((r) => r.data),
  markNotificationRead: (id: string) =>
    api.post<{ message: string }>(`/api/customers/notifications/${id}/read`).then((r) => r.data),
};
