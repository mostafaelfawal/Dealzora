import {
  cleanParams,
  newClientRef,
  toCents,
  toMs,
  toMsOrNull,
  toPounds,
} from "@/lib/apiMap";
import { api } from "@/lib/axios";
import type { PosInvoice } from "@/features/pos/types/pos";

import type {
  Reservation,
  ReservationFilter,
  ReservationInput,
  ReservationList,
  ReservationStatus,
} from "../types/reservation";

interface ReservationDto {
  id: string;
  number: number;
  status: ReservationStatus;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_balance: number | null;
  pickup_on: string | null;
  is_overdue: boolean;
  deposit: number;
  total: number;
  item_count: number;
  note: string | null;
  invoice: PosInvoice;
  created_at: string;
  cashier_name: string | null;
  sale_id: string | null;
  sale_number: number | null;
  closed_at: string | null;
}

interface ReservationListDto {
  items: ReservationDto[];
  total: number;
  counts: {
    pending: number;
    ready: number;
    overdue: number;
    due_today: number;
    open_deposits: number;
  };
}

const toReservation = (d: ReservationDto): Reservation => ({
  id: d.id,
  number: d.number,
  status: d.status,
  customerId: d.customer_id,
  customerName: d.customer_name,
  customerPhone: d.customer_phone,
  customerBalance:
    d.customer_balance === null ? null : toPounds(d.customer_balance),
  pickupOn: d.pickup_on,
  isOverdue: d.is_overdue,
  deposit: toPounds(d.deposit),
  total: toPounds(d.total),
  itemCount: d.item_count,
  note: d.note,
  invoice: d.invoice,
  createdAt: toMs(d.created_at),
  cashierName: d.cashier_name,
  saleId: d.sale_id,
  saleNumber: d.sale_number,
  closedAt: toMsOrNull(d.closed_at),
});

export async function fetchReservations(params: {
  filter: ReservationFilter;
  q: string;
  page: number;
  pageSize: number;
}): Promise<ReservationList> {
  const { data } = await api.get<ReservationListDto>("/reservations", {
    params: cleanParams({
      filter: params.filter,
      q: params.q.trim(),
      page: params.page,
      page_size: params.pageSize,
    }),
  });
  return {
    items: data.items.map(toReservation),
    total: data.total,
    counts: {
      pending: data.counts.pending,
      ready: data.counts.ready,
      overdue: data.counts.overdue,
      dueToday: data.counts.due_today,
      openDeposits: toPounds(data.counts.open_deposits),
    },
  };
}

export const fetchReservation = async (id: string) =>
  toReservation((await api.get<ReservationDto>(`/reservations/${id}`)).data);

export const fetchCustomerReservations = async (customerId: string) =>
  (
    await api.get<ReservationDto[]>(`/reservations/customer/${customerId}`)
  ).data.map(toReservation);

/** الفاتورة تُحفظ بلا ربط حجز سابق (حجز من حجز = نسخة جديدة). */
export const createReservation = async (input: ReservationInput) =>
  toReservation(
    (
      await api.post<ReservationDto>("/reservations", {
        client_ref: newClientRef(),
        customer_id: input.customerId,
        invoice: { ...input.invoice, reservation: null },
        pickup_on: input.pickupOn,
        deposit: toCents(input.deposit),
        note: input.note?.trim() || null,
      })
    ).data,
  );

export const updateReservation = async (
  id: string,
  input: { pickupOn: string | null; note: string | null },
) =>
  toReservation(
    (
      await api.patch<ReservationDto>(`/reservations/${id}`, {
        pickup_on: input.pickupOn,
        note: input.note?.trim() || null,
      })
    ).data,
  );

export const setReservationReady = async (id: string, ready: boolean) =>
  toReservation(
    (
      await api.post<ReservationDto>(`/reservations/${id}/ready`, null, {
        params: { ready },
      })
    ).data,
  );

export const cancelReservation = async (id: string) =>
  toReservation(
    (await api.post<ReservationDto>(`/reservations/${id}/cancel`)).data,
  );
