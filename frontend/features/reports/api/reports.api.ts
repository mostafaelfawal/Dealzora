import { fromQty, toMs, toPounds } from "@/lib/apiMap";
import { api } from "@/lib/axios";
import { parseIsoDay } from "@/lib/dates";

import type {
  DebtsReport,
  ProductRank,
  ProductRow,
  SalesReport,
  TreasuryReport,
} from "../types/report";

type Range = { from: string; to: string };
const rangeParams = (r: Range) => ({ date_from: r.from, date_to: r.to });

interface ProductRowDto {
  product_id: string;
  name: string;
  unit: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  stock_qty: number;
}

const toProductRow = (d: ProductRowDto): ProductRow => ({
  productId: d.product_id,
  name: d.name,
  unit: d.unit,
  qty: fromQty(d.qty),
  revenue: toPounds(d.revenue),
  cost: toPounds(d.cost),
  profit: toPounds(d.profit),
  stock: fromQty(d.stock_qty),
});

export async function fetchSalesReport(r: Range): Promise<SalesReport> {
  const { data } = await api.get("/reports/sales", { params: rangeParams(r) });
  const p = toPounds;
  return {
    days: data.days.map((d: Record<string, number | string>) => ({
      day: parseIsoDay(d.day as string),
      count: d.count as number,
      revenue: p(d.revenue as number),
      returns: p(d.returns as number),
      net: p(d.net as number),
      cost: p(d.cost as number),
      profit: p(d.profit as number),
    })),
    count: data.count,
    revenue: p(data.revenue),
    returns: p(data.returns),
    net: p(data.net),
    cost: p(data.cost),
    profit: p(data.profit),
    discounts: p(data.discounts),
    cash: p(data.cash),
    credit: p(data.credit),
    wallet: p(data.wallet ?? 0),
    electronic: (
      (data.electronic ?? []) as { key: string; label: string; value: number }[]
    ).map((e) => ({ key: e.key, label: e.label, value: p(e.value) })),
    expenses: p(data.expenses),
    netProfit: p(data.net_profit),
  };
}

export async function fetchProductsReport(
  r: Range,
  rank: ProductRank,
  limit = 20,
) {
  const { data } = await api.get<{ items: ProductRowDto[] }>(
    "/reports/products",
    {
      params: { ...rangeParams(r), rank, limit },
    },
  );
  return data.items.map(toProductRow);
}

export async function fetchDebtsReport(): Promise<DebtsReport> {
  const { data } = await api.get("/reports/debts");
  return {
    customersTotal: toPounds(data.customers_total),
    overdueTotal: toPounds(data.overdue_total),
    overdueCount: data.overdue_count,
    customers: data.customers.map((c: Record<string, never>) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      balance: toPounds(c.balance),
      creditLimit: toPounds(c.credit_limit),
      lastPaymentAt: c.last_payment_at ? toMs(c.last_payment_at) : null,
      isOverdue: c.is_overdue,
    })),
    suppliersTotal: toPounds(data.suppliers_total),
    suppliers: data.suppliers.map((s: Record<string, never>) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      balance: toPounds(s.balance),
    })),
  };
}

export async function fetchTreasuryReport(r: Range): Promise<TreasuryReport> {
  const { data } = await api.get("/reports/treasury", {
    params: rangeParams(r),
  });
  return {
    opening: toPounds(data.opening),
    totalIn: toPounds(data.total_in),
    totalOut: toPounds(data.total_out),
    closing: toPounds(data.closing),
    byKind: data.by_kind.map((k: Record<string, never>) => ({
      kind: k.kind,
      direction: k.direction,
      count: k.count,
      total: toPounds(k.total),
    })),
  };
}
