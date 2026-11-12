import {
  fromQty,
  toCents,
  toMs,
  toMsOrNull,
  toPounds,
  toQty,
} from "@/lib/apiMap";
import { api } from "@/lib/axios";

import type {
  OrderInput,
  OrdersSummary,
  OrderStatus,
  OrderStatusFilter,
  PurchaseOrder,
  ReorderSettings,
  SuggestionsResult,
  Urgency,
} from "../types/purchaseOrder";

interface SuggestionDto {
  product_id: string;
  name: string;
  barcode: string | null;
  category_name: string | null;
  unit: string;
  allow_decimal: boolean;
  stock: number;
  min_stock: number;
  on_order: number;
  sold_qty: number;
  avg_daily: number;
  days_left: number | null;
  urgency: Urgency;
  suggested_qty: number;
  pack_name: string | null;
  pack_factor: number | null;
  unit_cost: number;
  line_total: number;
  supplier_id: string | null;
  supplier_name: string | null;
  last_purchased_on: string | null;
}

interface SuggestionsDto {
  items: SuggestionDto[];
  totals: {
    count: number;
    out: number;
    critical: number;
    low: number;
    soon: number;
    estimated_total: number;
    suppliers: number;
  };
}

export async function fetchSuggestions(
  s: ReorderSettings,
): Promise<SuggestionsResult> {
  const { data } = await api.get<SuggestionsDto>(
    "/purchase-orders/suggestions",
    {
      params: {
        sales_days: s.salesDays,
        cover_days: s.coverDays,
        lead_days: s.leadDays,
        round_packs: s.roundPacks,
      },
    },
  );
  return {
    items: data.items.map((d) => ({
      productId: d.product_id,
      name: d.name,
      barcode: d.barcode ?? "",
      categoryName: d.category_name,
      unit: d.unit,
      allowDecimal: d.allow_decimal,
      stock: fromQty(d.stock),
      minStock: fromQty(d.min_stock),
      onOrder: fromQty(d.on_order),
      soldQty: fromQty(d.sold_qty),
      avgDaily: fromQty(d.avg_daily),
      daysLeft: d.days_left,
      urgency: d.urgency,
      suggestedQty: fromQty(d.suggested_qty),
      packName: d.pack_name,
      packSize: d.pack_factor === null ? null : fromQty(d.pack_factor),
      unitCost: toPounds(d.unit_cost),
      lineTotal: toPounds(d.line_total),
      supplierId: d.supplier_id,
      supplierName: d.supplier_name,
      lastPurchasedOn: d.last_purchased_on,
    })),
    totals: {
      ...data.totals,
      estimatedTotal: toPounds(data.totals.estimated_total),
    },
  };
}

interface OrderDto {
  id: string;
  number: number;
  version: number;
  supplier_id: string;
  supplier_name: string;
  supplier_phone: string | null;
  status: OrderStatus;
  total: number;
  note: string | null;
  created_at: string;
  created_by_name: string | null;
  sent_at: string | null;
  closed_at: string | null;
  purchase_id: string | null;
  purchase_number: number | null;
  lines: {
    id: string;
    product_id: string;
    name: string;
    unit_name: string;
    qty: number;
    unit_cost: number;
    line_total: number;
    stock_at_order: number;
    current_stock: number | null;
  }[];
}

const toOrder = (d: OrderDto): PurchaseOrder => ({
  id: d.id,
  number: d.number,
  version: d.version,
  supplierId: d.supplier_id,
  supplierName: d.supplier_name,
  supplierPhone: d.supplier_phone,
  status: d.status,
  total: toPounds(d.total),
  note: d.note ?? "",
  createdAt: toMs(d.created_at),
  createdByName: d.created_by_name,
  sentAt: toMsOrNull(d.sent_at),
  closedAt: toMsOrNull(d.closed_at),
  purchaseId: d.purchase_id,
  purchaseNumber: d.purchase_number,
  lines: d.lines.map((l) => ({
    id: l.id,
    productId: l.product_id,
    name: l.name,
    unitName: l.unit_name,
    qty: fromQty(l.qty),
    unitCost: toPounds(l.unit_cost),
    lineTotal: toPounds(l.line_total),
    stockAtOrder: fromQty(l.stock_at_order),
    currentStock: l.current_stock === null ? null : fromQty(l.current_stock),
  })),
});

export async function fetchOrders(
  status: OrderStatusFilter,
  page: number,
  pageSize: number,
) {
  const { data } = await api.get<{ items: OrderDto[]; total: number }>(
    "/purchase-orders",
    // بدون cleanParams: هي تحذف "all"، والـ backend افتراضه "open".
    { params: { status, page, page_size: pageSize } },
  );
  return { items: data.items.map(toOrder), total: data.total };
}

export const fetchOrder = async (id: string) =>
  toOrder((await api.get<OrderDto>(`/purchase-orders/${id}`)).data);

export async function fetchOrdersSummary(): Promise<OrdersSummary> {
  const { data } = await api.get<{
    draft: number;
    sent: number;
    open_total: number;
    received_month: number;
  }>("/purchase-orders/summary");
  return {
    draft: data.draft,
    sent: data.sent,
    openTotal: toPounds(data.open_total),
    receivedMonth: data.received_month,
  };
}

const toBody = (input: OrderInput) => ({
  supplier_id: input.supplierId,
  note: input.note.trim() || null,
  lines: input.lines.map((l) => ({
    product_id: l.productId,
    qty: toQty(l.qty),
    unit_cost: toCents(l.unitCost),
  })),
});

export const createOrder = async (input: OrderInput) =>
  toOrder((await api.post<OrderDto>("/purchase-orders", toBody(input))).data);

export const updateOrder = async (
  id: string,
  version: number,
  input: OrderInput,
) =>
  toOrder(
    (
      await api.put<OrderDto>(`/purchase-orders/${id}`, {
        ...toBody(input),
        base_version: version,
      })
    ).data,
  );

export const markOrderSent = async (id: string, version: number) =>
  toOrder(
    (
      await api.post<OrderDto>(`/purchase-orders/${id}/send`, {
        base_version: version,
      })
    ).data,
  );

export const cancelOrder = async (id: string, version: number) =>
  toOrder(
    (
      await api.post<OrderDto>(`/purchase-orders/${id}/cancel`, {
        base_version: version,
      })
    ).data,
  );
