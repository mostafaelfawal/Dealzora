import { fromQty, toMs, toPounds, toPoundsOrNull, toQty } from "@/lib/apiMap";
import { api } from "@/lib/axios";

import type {
  AdjustInput,
  LedgerEntry,
  StockReport,
  StockRow,
} from "../types/inventory";

interface MovementDto {
  id: string;
  product_id: string;
  movement_type: LedgerEntry["type"];
  qty_delta: number;
  balance_after: number;
  unit_cost: number | null;
  note: string | null;
  ref_type: string | null;
  ref_id: string | null;
  created_by: string | null;
  created_at: string;
}

interface StockRowDto {
  product_id: string;
  name: string;
  unit: string;
  stock_qty: number;
  min_stock: number;
  cost_price: number;
  stock_value: number;
  last_sold_at: string | null;
}

const toMovement = (d: MovementDto): LedgerEntry => ({
  id: d.id,
  type: d.movement_type,
  qtyDelta: fromQty(d.qty_delta),
  balanceAfter: fromQty(d.balance_after),
  unitCost: toPoundsOrNull(d.unit_cost),
  note: d.note ?? "",
  refType: d.ref_type,
  createdAt: toMs(d.created_at),
});

const toRow = (d: StockRowDto): StockRow => ({
  productId: d.product_id,
  name: d.name,
  unit: d.unit,
  stock: fromQty(d.stock_qty),
  minStock: fromQty(d.min_stock),
  costPrice: toPounds(d.cost_price),
  stockValue: toPounds(d.stock_value),
  lastSoldAt: d.last_sold_at ? toMs(d.last_sold_at) : null,
});

/** حركة صنف (الأحدث أولاً). */
export async function fetchLedger(
  productId: string,
  page: number,
  pageSize: number,
) {
  const { data } = await api.get<{ items: MovementDto[]; total: number }>(
    `/products/${productId}/stock-ledger`,
    { params: { page, page_size: pageSize } },
  );
  return { items: data.items.map(toMovement), total: data.total };
}

/** تعديل يدوي: جرد (الرصيد الفعلي) / تالف / هدية / أخرى (± بفرق موقّع). */
export const adjustStock = async (productId: string, input: AdjustInput) =>
  toMovement(
    (
      await api.post<MovementDto>(`/products/${productId}/stock-adjustments`, {
        reason: input.reason,
        qty: toQty(input.qty),
        note: input.note.trim() || null,
      })
    ).data,
  );

/** النواقص والراكد وقيمة المخزون (للمدير). */
export async function fetchStockReport(
  stagnantDays: number,
): Promise<StockReport> {
  const { data } = await api.get<{
    stock_value: number;
    low: StockRowDto[];
    out: StockRowDto[];
    stagnant: StockRowDto[];
    stagnant_value: number;
  }>("/reports/stock", { params: { stagnant_days: stagnantDays, limit: 500 } });
  return {
    stockValue: toPounds(data.stock_value),
    low: data.low.map(toRow),
    out: data.out.map(toRow),
    stagnant: data.stagnant.map(toRow),
    stagnantValue: toPounds(data.stagnant_value),
  };
}
