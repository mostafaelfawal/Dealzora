import type { PosInvoice } from "@/features/pos/types/pos";

export type ReservationStatus = "pending" | "ready" | "picked_up" | "cancelled";

export type ReservationFilter =
  "open" | "pending" | "ready" | "overdue" | "picked_up" | "cancelled" | "all";

/** حجز عميل: أصناف يستلمها لاحقاً، بعربون اختياري (المال بالجنيه). */
export interface Reservation {
  id: string;
  number: number;
  status: ReservationStatus;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  /** رصيد العميل الآن: موجب = عليه، سالب = له لدى المحل. */
  customerBalance: number | null;
  /** يوم الاستلام YYYY-MM-DD، أو null بلا موعد. */
  pickupOn: string | null;
  isOverdue: boolean;
  deposit: number;
  /** الإجمالي التقديري وقت الحجز (يُعاد التسعير عند الاستلام). */
  total: number;
  itemCount: number;
  note: string | null;
  invoice: PosInvoice;
  createdAt: number;
  cashierName: string | null;
  saleId: string | null;
  saleNumber: number | null;
  closedAt: number | null;
}

export interface ReservationCounts {
  pending: number;
  ready: number;
  overdue: number;
  dueToday: number;
  openDeposits: number;
}

export interface ReservationList {
  items: Reservation[];
  total: number;
  counts: ReservationCounts;
}

export interface ReservationInput {
  customerId: string;
  invoice: PosInvoice;
  pickupOn: string | null;
  deposit: number;
  note: string | null;
}
