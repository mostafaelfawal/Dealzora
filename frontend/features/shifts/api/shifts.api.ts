import {
  toCents,
  toMs,
  toMsOrNull,
  toPounds,
  toPoundsOrNull,
} from "@/lib/apiMap";
import { api } from "@/lib/axios";

import type { Shift } from "../types/shift";
import type { ShiftDto, ShiftListDto } from "../types/shiftApi";

export const toShift = (d: ShiftDto): Shift => ({
  id: d.id,
  cashierId: d.cashier_id,
  cashierName: d.cashier_name,
  deviceName: d.device_name,
  isOpen: d.is_open,
  openedAt: toMs(d.opened_at),
  closedAt: toMsOrNull(d.closed_at),
  openingFloat: toPounds(d.opening_float),
  salesCount: d.sales_count,
  returnsCount: d.returns_count,
  salesTotal: toPoundsOrNull(d.sales_total),
  cashSales: toPoundsOrNull(d.cash_sales),
  creditSales: toPoundsOrNull(d.credit_sales),
  cashRefunds: toPoundsOrNull(d.cash_refunds),
  walletSales: toPoundsOrNull(d.wallet_sales ?? null),
  electronic: d.electronic
    ? d.electronic.map((e) => ({ ...e, value: toPounds(e.value) }))
    : null,
  walletRefunds: toPoundsOrNull(d.wallet_refunds ?? null),
  expectedCash: toPoundsOrNull(d.expected_cash),
  countedCash: toPoundsOrNull(d.counted_cash),
  difference: toPoundsOrNull(d.difference),
  note: d.note ?? "",
  version: d.version,
});

export const fetchCurrentShift = async (): Promise<Shift | null> => {
  const { data } = await api.get<ShiftDto | null>("/shifts/current");
  return data ? toShift(data) : null;
};

export const fetchShifts = async (page: number, pageSize: number) => {
  const { data } = await api.get<ShiftListDto>("/shifts", {
    params: { page, page_size: pageSize },
  });
  return { items: data.items.map(toShift), total: data.total };
};

export const openShift = async (openingFloat: number): Promise<Shift> =>
  toShift(
    (
      await api.post<ShiftDto>("/shifts/open", {
        opening_float: toCents(openingFloat),
      })
    ).data,
  );

export const closeShift = async (
  countedCash: number,
  note: string,
): Promise<Shift> =>
  toShift(
    (
      await api.post<ShiftDto>("/shifts/current/close", {
        counted_cash: toCents(countedCash),
        note: note.trim() || null,
      })
    ).data,
  );
