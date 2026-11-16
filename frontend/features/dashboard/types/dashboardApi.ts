import { Overview } from "./dashboard";

/* شكل الـ backend (قروش، كميات × 1000، snake_case). */
export type KpisDto = Record<
  | "net_sales"
  | "gross_profit"
  | "expenses"
  | "net_profit"
  | "invoices"
  | "avg_ticket"
  | "items_sold"
  | "returns"
  | "discounts"
  | "cash_sales"
  | "credit_sales"
  | "wallet_sales",
  number
>;
export interface NamedDto {
  key: string;
  label: string;
  value: number;
  extra: number;
}
export interface OverviewDto {
  date_from: string;
  date_to: string;
  prev_from: string;
  prev_to: string;
  kpis: KpisDto;
  prev: KpisDto;
  trend: {
    day: string;
    net: number;
    profit: number;
    invoices: number;
    prev_net: number;
    prev_profit: number;
  }[];
  heatmap: { weekday: number; hour: number; invoices: number; net: number }[];
  payments: NamedDto[];
  top_products: NamedDto[];
  categories: NamedDto[];
  expenses_by_category: NamedDto[];
  cash_flow: { day: string; cash_in: number; cash_out: number }[];
  cashiers: {
    user_id: string;
    name: string;
    invoices: number;
    net: number;
    returns: number;
    avg_ticket: number;
    discounts: number;
  }[];
  health: Record<string, number>;
  shift: {
    cashier_name: string | null;
    opened_at: string;
    sales_count: number;
    expected_cash: number;
  } | null;
  recent_sales: {
    id: string;
    number: number;
    sold_at: string;
    customer_name: string | null;
    payment_method: Overview["recentSales"][number]["paymentMethod"];
    payment_label: string;
    total: number;
  }[];
  return_reasons: NamedDto[];
  promotions: {
    active: number;
    scheduled: number;
    discount: number;
    prev_discount: number;
    invoices: number;
    top: NamedDto[];
  };
  loyalty: {
    enabled: boolean;
    earned: number;
    redeemed: number;
    redeem_value: number;
    outstanding_points: number;
    outstanding_value: number;
    members: number;
  } | null;
  customers: {
    new_customers: number;
    active_customers: number;
    top: NamedDto[];
  } | null;
  purchasing: {
    purchases_total: number;
    prev_purchases_total: number;
    purchases_count: number;
    draft_orders: number;
    sent_orders: number;
    open_orders_total: number;
    received_month: number;
  } | null;
  expiry: {
    tracked_products: number;
    expired_batches: number;
    expired_value: number;
    soon_7: number;
    soon_30: number;
    soon_30_value: number;
  } | null;
}
