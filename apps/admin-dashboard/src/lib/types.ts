export interface Role {
  id: string;
  name: string;
}

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  roles: Role[];
  last_login_at?: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface DateRange {
  start: string; // yyyy-MM-dd
  end: string; // yyyy-MM-dd
}

export interface Overview {
  period_start: string;
  period_end: string;
  total_customers: number;
  active_customers: number;
  new_customers: number;
  total_products: number;
  total_orders: number;
  total_units_sold: number;
  active_groups: number;
  successful_groups: number;
  expired_groups: number;
  cancelled_groups: number;
  gmv: number;
  paid_order_value: number;
  refund_amount: number;
  net_sales_revenue: number;
  average_order_value: number;
  group_success_rate: number;
  group_buying_conversion_rate: number;
  formulas: Record<string, string>;
}

export interface RevenueAnalytics extends Overview {
  by_type: Record<string, { orders: number; revenue: number }>;
}

export interface GroupAnalytics {
  period_start: string;
  period_end: string;
  groups_created: number;
  successful_groups: number;
  expired_groups: number;
  cancelled_groups: number;
  group_success_rate: number;
  average_completion_seconds: number;
  average_participants_per_successful_group: number;
}

export interface CustomerAnalytics {
  total_customers: number;
  new_customers: number;
  active_customers: number;
  period_start: string;
  period_end: string;
}

export interface ProductSales {
  product_id: string;
  name: string;
  sku: string;
  individual_price: number;
  group_price: number;
  units_sold: number;
  revenue: number;
  individual_units: number;
  group_units: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  short_description: string;
  individual_price: string | number;
  group_price: string | number;
  discount_percentage: string | number;
  currency: string;
  group_size: number;
  is_group_buy_enabled: boolean;
  is_featured: boolean;
  rating_avg: string | number;
  rating_count: number;
  successful_groups_count: number;
  units_sold: number;
  primary_image_url?: string | null;
  available_qty?: number | null;
}

export interface Participant {
  id: string;
  user_id: string;
  payment_status: string;
  quantity: number;
  amount: string | number;
  joined_via_invite: boolean;
  confirmed_at?: string | null;
  created_at: string;
  user_first_name?: string | null;
  user_last_name?: string | null;
}

export interface Group {
  id: string;
  product_id: string;
  creator_id: string;
  required_participants: number;
  confirmed_participants: number;
  pending_participants: number;
  remaining_participants: number;
  progress_percent: number;
  group_price: string | number;
  currency: string;
  status: string;
  expires_at: string;
  completed_at?: string | null;
  invite_code: string;
  created_at: string;
  product?: Product | null;
  invite_url?: string | null;
  creator_name?: string | null;
  total_confirmed_payment?: number;
}

export interface GroupDetail extends Group {
  participants: Participant[];
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  unit_price: string | number;
  quantity: number;
  line_total: string | number;
  purchase_type: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  purchase_type: string;
  buying_group_id?: string | null;
  status: string;
  subtotal: string | number;
  discount_amount: string | number;
  shipping_amount: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  currency: string;
  paid_at?: string | null;
  created_at: string;
  items: OrderItem[];
}

export interface Customer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  roles: string[];
  created_at: string;
  last_login_at?: string | null;
}

export interface InventoryRow {
  product_id: string;
  sku: string | null;
  name: string | null;
  available_qty: number;
  reserved_qty: number;
  sold_qty: number;
  is_low_stock: boolean;
  low_stock_threshold: number;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}
