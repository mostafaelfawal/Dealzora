import { fromQty, toPounds } from "@/lib/apiMap";
import { api } from "@/lib/axios";

export type ExpiryStatus = "expired" | "soon" | "valid" | "all";

export interface Batch {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  batchNo: string | null;
  /** YYYY-MM-DD */
  expiryDate: string | null;
  /** سالب = منتهي منذ كذا يوم. */
  daysLeft: number | null;
  qtyIn: number;
  qtyRemaining: number;
  unitCost: number;
  /** قيمة المتبقي بسعر الشراء. */
  value: number;
  receivedOn: string;
  source: string;
}

export interface ExpirySummary {
  trackedProducts: number;
  expiredBatches: number;
  expiredValue: number;
  soon7: number;
  soon30: number;
  soon30Value: number;
}

interface BatchDto {
  id: string;
  product_id: string;
  product_name: string;
  unit: string;
  batch_no: string | null;
  expiry_date: string | null;
  days_left: number | null;
  qty_in: number;
  qty_remaining: number;
  unit_cost: number;
  value: number;
  received_on: string;
  source: string;
}

const toBatch = (d: BatchDto): Batch => ({
  id: d.id,
  productId: d.product_id,
  productName: d.product_name,
  unit: d.unit,
  batchNo: d.batch_no,
  expiryDate: d.expiry_date,
  daysLeft: d.days_left,
  qtyIn: fromQty(d.qty_in),
  qtyRemaining: fromQty(d.qty_remaining),
  unitCost: toPounds(d.unit_cost),
  value: toPounds(d.value),
  receivedOn: d.received_on,
  source: d.source,
});

export async function fetchExpiryList(
  status: ExpiryStatus,
  days: number,
  q: string,
): Promise<Batch[]> {
  const { data } = await api.get<{ items: BatchDto[] }>("/batches/expiry", {
    params: { status, days, q: q.trim() || undefined },
  });
  return data.items.map(toBatch);
}

export async function fetchExpirySummary(): Promise<ExpirySummary> {
  const { data } = await api.get<{
    tracked_products: number;
    expired_batches: number;
    expired_value: number;
    soon_7: number;
    soon_30: number;
    soon_30_value: number;
  }>("/batches/summary");
  return {
    trackedProducts: data.tracked_products,
    expiredBatches: data.expired_batches,
    expiredValue: toPounds(data.expired_value),
    soon7: data.soon_7,
    soon30: data.soon_30,
    soon30Value: toPounds(data.soon_30_value),
  };
}

export const writeOffBatch = async (id: string, note?: string) =>
  toBatch(
    (
      await api.post<BatchDto>(`/batches/${id}/write-off`, {
        note: note?.trim() || null,
      })
    ).data,
  );
