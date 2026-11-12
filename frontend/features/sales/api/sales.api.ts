import {
  cleanParams,
  fromQty,
  toCents,
  toMs,
  toPounds,
  toPoundsOrNull,
  toQty,
} from "@/lib/apiMap";
import { api } from "@/lib/axios";

import { paymentLabel } from "../config/saleOptions";

import type {
  ReturnInput,
  Sale,
  SaleFilters,
  SaleInput,
  SaleReturn,
  SalesSummary,
} from "../types/sale";
import type {
  ExchangeDto,
  ReturnDto,
  ReturnListDto,
  SaleDto,
  SaleListDto,
  SalesSummaryDto,
} from "../types/saleApi";

/* ---------- mappers ---------- */

export const toSale = (d: SaleDto): Sale => ({
  id: d.id,
  number: d.number,
  soldAt: toMs(d.sold_at),
  customerId: d.customer_id,
  customerName: d.customer_name,
  customerPhone: d.customer_phone,
  cashierName: d.cashier_name,
  paymentMethod: d.payment_method,
  paymentLabel: d.payment_label ?? paymentLabel(d.payment_method),
  subtotal: toPounds(d.subtotal),
  linesDiscount: toPounds(d.lines_discount),
  promoDiscount: toPounds(d.promo_discount ?? 0),
  loyaltyRedeemed: d.loyalty_redeemed ?? 0,
  loyaltyDiscount: toPounds(d.loyalty_discount ?? 0),
  loyaltyEarned: d.loyalty_earned ?? 0,
  customerPoints: d.customer_points ?? null,
  invoiceDiscount: toPounds(d.invoice_discount),
  total: toPounds(d.total),
  cashAmount: toPounds(d.cash_amount),
  creditAmount: toPounds(d.credit_amount),
  walletAmount: toPounds(d.wallet_amount ?? 0),
  paymentRef: d.payment_ref ?? null,
  received: toPounds(d.received),
  change: toPounds(d.change),
  returnedTotal: toPounds(d.returned_total),
  costTotal: toPoundsOrNull(d.cost_total),
  profit: toPoundsOrNull(d.profit),
  note: d.note ?? "",
  lines: d.lines.map((l) => ({
    id: l.id,
    productId: l.product_id,
    unitId: l.unit_id,
    name: l.name,
    unitName: l.unit_name,
    factor: fromQty(l.factor),
    qty: fromQty(l.qty),
    unitPrice: toPounds(l.unit_price),
    discount: toPounds(l.discount),
    promoDiscount: toPounds(l.promo_discount ?? 0),
    promoName: l.promo_name ?? null,
    isWholesale: l.is_wholesale ?? false,
    lineTotal: toPounds(l.line_total),
    netTotal: toPounds(l.net_total),
    returnedQty: fromQty(l.returned_qty),
    unitCost: toPoundsOrNull(l.unit_cost),
  })),
});

export const toSaleReturn = (d: ReturnDto): SaleReturn => ({
  id: d.id,
  number: d.number,
  saleId: d.sale_id,
  saleNumber: d.sale_number,
  returnedAt: toMs(d.returned_at),
  reason: d.reason,
  note: d.note ?? "",
  customerName: d.customer_name,
  cashierName: d.cashier_name,
  total: toPounds(d.total),
  cashRefund: toPounds(d.cash_refund),
  creditRefund: toPounds(d.credit_refund),
  walletRefund: toPounds(d.wallet_refund ?? 0),
  lines: d.lines.map((l) => ({
    id: l.id,
    saleLineId: l.sale_line_id,
    productId: l.product_id,
    name: l.name,
    unitName: l.unit_name,
    qty: fromQty(l.qty),
    amount: toPounds(l.amount),
  })),
});

const toSalePayload = (s: SaleInput) => ({
  client_ref: s.clientRef,
  customer_id: s.customerId,
  lines: s.lines.map((l) => ({
    product_id: l.productId,
    unit_id: l.unitId ?? null,
    qty: toQty(l.qty),
    unit_price: toCents(l.unitPrice),
    discount: toCents(l.discount),
    promo_discount: toCents(l.promoDiscount),
  })),
  invoice_discount: toCents(s.invoiceDiscount),
  payment_method: s.paymentMethod,
  cash_amount: toCents(s.cashAmount),
  received: toCents(s.received),
  payment_ref: s.paymentRef?.trim() || null,
  note: s.note || null,
  redeem_points: s.redeemPoints ?? 0,
});

const toReturnPayload = (r: ReturnInput) => ({
  reason: r.reason,
  note: r.note || null,
  lines: r.lines.map((l) => ({
    sale_line_id: l.saleLineId,
    qty: toQty(l.qty),
  })),
  ...(r.refundVia ? { refund_via: r.refundVia } : {}),
});

/* ---------- endpoints ---------- */

export async function fetchSales(f: SaleFilters) {
  const { data } = await api.get<SaleListDto>("/sales", {
    params: cleanParams({
      q: f.q?.trim(),
      customer_id: f.customerId,
      method: f.method,
      status: f.status,
      date_from: f.dateFrom,
      date_to: f.dateTo,
      sort: f.sort,
      page: f.page,
      page_size: f.pageSize,
    }),
  });
  return { items: data.items.map(toSale), total: data.total };
}

export const fetchSale = async (id: string): Promise<Sale> =>
  toSale((await api.get<SaleDto>(`/sales/${id}`)).data);

export const fetchSalesSummary = async (): Promise<SalesSummary> => {
  const { data } = await api.get<SalesSummaryDto>("/sales/summary");
  return {
    todayCount: data.today_count,
    todayTotal: toPounds(data.today_total),
    todayProfit: toPounds(data.today_profit),
    todayReturns: toPounds(data.today_returns),
    weekTotal: toPounds(data.week_total),
    monthTotal: toPounds(data.month_total),
    monthProfit: toPounds(data.month_profit),
  };
};

export async function fetchReturns(f: {
  q?: string;
  reason?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}) {
  const { data } = await api.get<ReturnListDto>("/sales/returns", {
    params: cleanParams({
      q: f.q?.trim(),
      reason: f.reason,
      date_from: f.dateFrom,
      date_to: f.dateTo,
      page: f.page,
      page_size: f.pageSize,
    }),
  });
  return { items: data.items.map(toSaleReturn), total: data.total };
}

export const createSale = async (input: SaleInput): Promise<Sale> =>
  toSale((await api.post<SaleDto>("/sales", toSalePayload(input))).data);

export const createReturn = async (
  saleId: string,
  input: ReturnInput,
): Promise<SaleReturn> =>
  toSaleReturn(
    (
      await api.post<ReturnDto>(
        `/sales/${saleId}/returns`,
        toReturnPayload(input),
      )
    ).data,
  );

export async function createExchange(
  saleId: string,
  ret: ReturnInput,
  sale: SaleInput | null,
) {
  const { data } = await api.post<ExchangeDto>("/sales/exchange", {
    sale_id: saleId,
    return_data: toReturnPayload(ret),
    sale: sale ? toSalePayload(sale) : null,
  });
  return {
    saleReturn: toSaleReturn(data.sale_return),
    sale: data.sale ? toSale(data.sale) : null,
  };
}
