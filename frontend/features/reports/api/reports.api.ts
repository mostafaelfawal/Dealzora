import { fromQty, toMs, toPounds } from "@/lib/apiMap";
import { api } from "@/lib/axios";
import { parseIsoDay } from "@/lib/dates";

import type {
  CashiersReport,
  CustomersReport,
  DebtsReport,
  ProductRank,
  ProductRow,
  ProductsReport,
  PromotionsReport,
  PurchasedProduct,
  PurchasesReport,
  ReturnsReport,
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
    promoDiscount: p(data.promo_discount ?? 0),
    linesDiscount: p(data.lines_discount ?? 0),
    invoiceDiscount: p(data.invoice_discount ?? 0),
    loyaltyDiscount: p(data.loyalty_discount ?? 0),
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

interface CategorySalesDto {
  id: string;
  name: string;
  revenue: number;
  profit: number;
  qty: number;
  products: number;
}

/** categoryId: قسم واحد، "none" = بدون قسم، null = كل الأقسام. */
export async function fetchProductsReport(
  r: Range,
  rank: ProductRank,
  limit = 20,
  categoryId: string | null = null,
): Promise<ProductsReport> {
  const { data } = await api.get<{
    items: ProductRowDto[];
    categories: CategorySalesDto[];
  }>("/reports/products", {
    params: {
      ...rangeParams(r),
      rank,
      limit,
      ...(categoryId ? { category_id: categoryId } : {}),
    },
  });
  return {
    items: data.items.map(toProductRow),
    categories: data.categories.map((c) => ({
      id: c.id,
      name: c.name,
      revenue: toPounds(c.revenue),
      profit: toPounds(c.profit),
      qty: fromQty(c.qty),
      products: c.products,
    })),
  };
}

/* ---------- تقارير الميزات الإضافية ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- شكل الـ DTO يُحوَّل هنا مباشرة
type Dto = any;

const toPurchased = (d: Dto): PurchasedProduct => ({
  productId: d.product_id,
  name: d.name,
  unit: d.unit,
  qty: fromQty(d.qty),
  total: toPounds(d.total),
  firstCost: toPounds(d.first_cost),
  lastCost: toPounds(d.last_cost),
  changePct: d.change_pct,
});

export async function fetchPurchasesReport(r: Range): Promise<PurchasesReport> {
  const { data } = await api.get<Dto>("/reports/purchases", {
    params: rangeParams(r),
  });
  const p = toPounds;
  return {
    total: p(data.total),
    count: data.count,
    paid: p(data.paid),
    credit: p(data.credit),
    discount: p(data.discount),
    returned: p(data.returned),
    net: p(data.net),
    bySupplier: data.by_supplier.map((s: Dto) => ({
      id: s.id,
      name: s.name,
      total: p(s.total),
      count: s.count,
      returned: p(s.returned),
    })),
    topProducts: data.top_products.map(toPurchased),
    priceChanges: data.price_changes.map(toPurchased),
    draftOrders: data.draft_orders,
    sentOrders: data.sent_orders,
    openOrdersTotal: p(data.open_orders_total),
    receivedOrders: data.received_orders,
    lateOrders: data.late_orders.map((o: Dto) => ({
      id: o.id,
      number: o.number,
      supplierName: o.supplier_name,
      total: p(o.total),
      sentAt: toMs(o.sent_at),
      days: o.days,
    })),
  };
}

export async function fetchPromotionsReport(
  r: Range,
): Promise<PromotionsReport> {
  const { data } = await api.get<Dto>("/reports/promotions", {
    params: rangeParams(r),
  });
  return {
    discount: toPounds(data.discount),
    invoices: data.invoices,
    salesCount: data.sales_count,
    manualDiscount: toPounds(data.manual_discount),
    promos: data.promos.map((x: Dto) => ({
      id: x.id,
      name: x.name,
      kind: x.kind,
      status: x.status,
      startsOn: x.starts_on,
      endsOn: x.ends_on,
      discount: toPounds(x.discount),
      lines: x.lines,
      invoices: x.invoices,
      qty: fromQty(x.qty),
      revenue: toPounds(x.revenue),
    })),
  };
}

export async function fetchReturnsReport(r: Range): Promise<ReturnsReport> {
  const { data } = await api.get<Dto>("/reports/returns", {
    params: rangeParams(r),
  });
  const p = toPounds;
  return {
    count: data.count,
    total: p(data.total),
    cashRefund: p(data.cash_refund),
    creditRefund: p(data.credit_refund),
    walletRefund: p(data.wallet_refund),
    revenue: p(data.revenue),
    byReason: data.by_reason.map((x: Dto) => ({
      key: x.key,
      value: p(x.value),
      count: x.extra,
    })),
    topProducts: data.top_products.map((x: Dto) => ({
      productId: x.product_id,
      name: x.name,
      unit: x.unit,
      qty: fromQty(x.qty),
      amount: p(x.amount),
      times: x.times,
    })),
    byCashier: data.by_cashier.map((x: Dto) => ({
      userId: x.user_id,
      name: x.name,
      count: x.count,
      total: p(x.total),
    })),
  };
}

export async function fetchCustomersReport(r: Range): Promise<CustomersReport> {
  const { data } = await api.get<Dto>("/reports/customers", {
    params: rangeParams(r),
  });
  const p = toPounds;
  const l = data.loyalty;
  return {
    totalCustomers: data.total_customers,
    active: data.active,
    new: data.new,
    walkInSales: p(data.walk_in_sales),
    customerSales: p(data.customer_sales),
    top: data.top.map((c: Dto) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      net: p(c.net),
      invoices: c.invoices,
      avgTicket: p(c.avg_ticket),
      lastAt: c.last_at ? toMs(c.last_at) : null,
      points: c.points,
    })),
    lapsed: data.lapsed.map((c: Dto) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      lastAt: toMs(c.last_at),
      days: c.days,
      lifetime: p(c.lifetime),
    })),
    loyalty: {
      enabled: l.enabled,
      earned: l.earned,
      redeemed: l.redeemed,
      redeemValue: p(l.redeem_value),
      adjusted: l.adjusted,
      outstandingPoints: l.outstanding_points,
      outstandingValue: p(l.outstanding_value),
      members: l.members,
      topBalances: l.top_balances.map((b: Dto) => ({
        id: b.key,
        name: b.label,
        points: b.value,
        value: p(b.extra),
      })),
    },
  };
}

export async function fetchCashiersReport(r: Range): Promise<CashiersReport> {
  const { data } = await api.get<Dto>("/reports/cashiers", {
    params: rangeParams(r),
  });
  const p = toPounds;
  return {
    cashiers: data.cashiers.map((c: Dto) => ({
      userId: c.user_id,
      name: c.name,
      invoices: c.invoices,
      sales: p(c.sales),
      returns: p(c.returns),
      returnsCount: c.returns_count,
      net: p(c.net),
      avgTicket: p(c.avg_ticket),
      manualDiscount: p(c.manual_discount),
      promoDiscount: p(c.promo_discount),
      shifts: c.shifts,
      shortage: p(c.shortage),
      overage: p(c.overage),
      worstDiff: p(c.worst_diff),
    })),
    shiftsCount: data.shifts_count,
    openShifts: data.open_shifts,
    shortage: p(data.shortage),
    overage: p(data.overage),
    differences: data.differences.map((d: Dto) => ({
      id: d.id,
      cashierName: d.cashier_name,
      openedAt: toMs(d.opened_at),
      closedAt: d.closed_at ? toMs(d.closed_at) : null,
      expected: p(d.expected),
      counted: p(d.counted),
      difference: p(d.difference),
    })),
  };
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
