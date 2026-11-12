import { fromQty, toMs, toPounds } from "@/lib/apiMap";
import { api } from "@/lib/axios";
import { parseIsoDay, type DateRange } from "@/lib/dates";

import type { Kpis, NamedValue, Overview } from "../types/dashboard";

/* شكل الـ backend (قروش، كميات × 1000، snake_case). */
type KpisDto = Record<
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
interface NamedDto {
  key: string;
  label: string;
  value: number;
  extra: number;
}
interface OverviewDto {
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
    total: number;
  }[];
}

const p = toPounds;

const toKpis = (k: KpisDto): Kpis => ({
  netSales: p(k.net_sales),
  grossProfit: p(k.gross_profit),
  expenses: p(k.expenses),
  netProfit: p(k.net_profit),
  invoices: k.invoices,
  avgTicket: p(k.avg_ticket),
  itemsSold: fromQty(k.items_sold),
  returns: p(k.returns),
  discounts: p(k.discounts),
  cashSales: p(k.cash_sales),
  creditSales: p(k.credit_sales),
  walletSales: p(k.wallet_sales ?? 0),
});

/** money: القيمتان مبالغ؟ (الأصناف: value ربح وextra إيراد؛ المصروفات: extra عدد). */
const toNamed = (d: NamedDto, extraIsMoney = true): NamedValue => ({
  key: d.key,
  label: d.label,
  value: p(d.value),
  extra: extraIsMoney ? p(d.extra) : d.extra,
});

export async function fetchOverview(range: DateRange): Promise<Overview> {
  const { data } = await api.get<OverviewDto>("/reports/overview", {
    params: { date_from: range.from, date_to: range.to },
  });
  const h = data.health;
  return {
    dateFrom: data.date_from,
    dateTo: data.date_to,
    prevFrom: data.prev_from,
    prevTo: data.prev_to,
    kpis: toKpis(data.kpis),
    prev: toKpis(data.prev),
    trend: data.trend.map((t) => ({
      day: parseIsoDay(t.day),
      net: p(t.net),
      profit: p(t.profit),
      invoices: t.invoices,
      prevNet: p(t.prev_net),
      prevProfit: p(t.prev_profit),
    })),
    heatmap: data.heatmap.map((c) => ({ ...c, net: p(c.net) })),
    payments: data.payments.map((x) => toNamed(x)),
    topProducts: data.top_products.map((x) => toNamed(x)),
    categories: data.categories.map((x) => toNamed(x)),
    expensesByCategory: data.expenses_by_category.map((x) => toNamed(x, false)),
    cashFlow: data.cash_flow.map((c) => ({
      day: parseIsoDay(c.day),
      cashIn: p(c.cash_in),
      cashOut: p(c.cash_out),
    })),
    cashiers: data.cashiers.map((c) => ({
      userId: c.user_id,
      name: c.name,
      invoices: c.invoices,
      net: p(c.net),
      returns: p(c.returns),
      avgTicket: p(c.avg_ticket),
      discounts: p(c.discounts),
    })),
    health: {
      stockValue: p(h.stock_value),
      lowStock: h.low_stock,
      outOfStock: h.out_of_stock,
      stagnantCount: h.stagnant_count,
      stagnantValue: p(h.stagnant_value),
      customersDebt: p(h.customers_debt),
      overdueCustomers: h.overdue_customers,
      overdueDebt: p(h.overdue_debt),
      suppliersPayable: p(h.suppliers_payable),
      treasuryBalance: p(h.treasury_balance),
    },
    shift: data.shift
      ? {
          cashierName: data.shift.cashier_name,
          openedAt: toMs(data.shift.opened_at),
          salesCount: data.shift.sales_count,
          expectedCash: p(data.shift.expected_cash),
        }
      : null,
    recentSales: data.recent_sales.map((s) => ({
      id: s.id,
      number: s.number,
      soldAt: toMs(s.sold_at),
      customerName: s.customer_name,
      paymentMethod: s.payment_method,
      total: p(s.total),
    })),
  };
}
