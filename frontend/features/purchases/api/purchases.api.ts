import { getProducts } from "@/features/products/api/products.api";
import type { Product } from "@/features/products/types/product";
import { getSuppliers } from "@/features/suppliers/api/suppliers.api";
import type { Supplier } from "@/features/suppliers/types/supplier";
import {
  cleanParams,
  fromQty,
  toCents,
  toMs,
  toPounds,
  toQty,
} from "@/lib/apiMap";
import { api } from "@/lib/axios";

import type {
  Purchase,
  PurchaseFilters,
  PurchaseInput,
  PurchasesSummary,
  RefundMethod,
} from "../types/purchase";

interface PurchaseDto {
  id: string;
  number: number;
  supplier_id: string;
  supplier_name: string;
  supplier_invoice: string | null;
  purchased_on: string;
  created_at: string;
  created_by_name: string | null;
  subtotal: number;
  discount: number;
  total: number;
  paid_amount: number;
  credit_amount: number;
  returned_total: number;
  note: string | null;
  lines: {
    id: string;
    product_id: string;
    name: string;
    unit_name: string;
    qty: number;
    unit_cost: number;
    line_total: number;
    returned_qty: number;
  }[];
}

const toPurchase = (d: PurchaseDto): Purchase => ({
  id: d.id,
  number: d.number,
  supplierId: d.supplier_id,
  supplierName: d.supplier_name,
  supplierInvoice: d.supplier_invoice ?? "",
  purchasedOn: d.purchased_on,
  createdAt: toMs(d.created_at),
  createdByName: d.created_by_name,
  subtotal: toPounds(d.subtotal),
  discount: toPounds(d.discount),
  total: toPounds(d.total),
  paidAmount: toPounds(d.paid_amount),
  creditAmount: toPounds(d.credit_amount),
  returnedTotal: toPounds(d.returned_total),
  note: d.note ?? "",
  lines: d.lines.map((l) => ({
    id: l.id,
    productId: l.product_id,
    name: l.name,
    unitName: l.unit_name,
    qty: fromQty(l.qty),
    unitCost: toPounds(l.unit_cost),
    lineTotal: toPounds(l.line_total),
    returnedQty: fromQty(l.returned_qty),
  })),
});

export async function fetchPurchases(f: PurchaseFilters) {
  const { data } = await api.get<{ items: PurchaseDto[]; total: number }>(
    "/purchases",
    {
      params: cleanParams({
        q: f.q.trim(),
        supplier_id: f.supplierId,
        status: f.status,
        date_from: f.dateFrom,
        date_to: f.dateTo,
        page: f.page,
        page_size: f.pageSize,
      }),
    },
  );
  return { items: data.items.map(toPurchase), total: data.total };
}

export const fetchPurchase = async (id: string) =>
  toPurchase((await api.get<PurchaseDto>(`/purchases/${id}`)).data);

export async function fetchPurchasesSummary(): Promise<PurchasesSummary> {
  const { data } = await api.get<{
    month_count: number;
    month_total: number;
    month_paid: number;
    returns_month: number;
  }>("/purchases/summary");
  return {
    monthCount: data.month_count,
    monthTotal: toPounds(data.month_total),
    monthPaid: toPounds(data.month_paid),
    returnsMonth: toPounds(data.returns_month),
  };
}

export const createPurchase = async (input: PurchaseInput) =>
  toPurchase(
    (
      await api.post<PurchaseDto>("/purchases", {
        supplier_id: input.supplierId,
        supplier_invoice: input.supplierInvoice.trim() || null,
        purchased_on: input.purchasedOn,
        lines: input.lines.map((l) => ({
          product_id: l.productId,
          qty: toQty(l.qty),
          unit_cost: toCents(l.unitCost),
          new_sale_price:
            l.newSalePrice === null ? null : toCents(l.newSalePrice),
        })),
        discount: toCents(input.discount),
        paid_amount: toCents(input.paidAmount),
        note: input.note.trim() || null,
        order_id: input.orderId ?? null,
      })
    ).data,
  );

export async function createPurchaseReturn(
  purchaseId: string,
  refundMethod: RefundMethod,
  lines: { lineId: string; qty: number }[],
  note: string,
) {
  const { data } = await api.post<{ number: number; total: number }>(
    `/purchases/${purchaseId}/returns`,
    {
      refund_method: refundMethod,
      note: note.trim() || null,
      lines: lines.map((l) => ({
        purchase_line_id: l.lineId,
        qty: toQty(l.qty),
      })),
    },
  );
  return { number: data.number, total: toPounds(data.total) };
}

/* ---------- قوائم مساعدة للفورم ---------- */

const PAGE = 200;

/** كل الأصناف (بأسعار الشراء، فهي للمدير فقط) للبحث السريع داخل الفورم. */
export async function fetchAllProducts(): Promise<Product[]> {
  const first = await getProducts({
    page: 1,
    page_size: PAGE,
    sort: "name_asc",
  });
  const items = [...first.items];
  const pages = Math.ceil(first.total / Math.max(first.pageSize, 1));
  for (let page = 2; page <= pages; page++)
    items.push(
      ...(await getProducts({ page, page_size: PAGE, sort: "name_asc" })).items,
    );
  return items;
}

export async function fetchAllSuppliers(): Promise<Supplier[]> {
  const first = await getSuppliers({
    page: 1,
    page_size: PAGE,
    sort: "name_asc",
  });
  const items = [...first.items];
  const pages = Math.ceil(first.total / Math.max(first.pageSize, 1));
  for (let page = 2; page <= pages; page++)
    items.push(
      ...(await getSuppliers({ page, page_size: PAGE, sort: "name_asc" }))
        .items,
    );
  return items;
}
