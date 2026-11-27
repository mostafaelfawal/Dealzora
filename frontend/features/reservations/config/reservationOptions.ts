import type {
  ReservationFilter,
  ReservationStatus,
} from "../types/reservation";

export const reservationKeys = {
  all: ["reservations"] as const,
  list: (filter: ReservationFilter, q: string, page: number) =>
    [...reservationKeys.all, "list", filter, q, page] as const,
  detail: (id: string) => [...reservationKeys.all, "detail", id] as const,
  customer: (customerId: string) =>
    [...reservationKeys.all, "customer", customerId] as const,
};

export const RESERVATIONS_PAGE_SIZE = 30;

export const RESERVATION_ROUTES = {
  list: "/admin/reservations",
  pos: "/pos",
} as const;

export const RESERVATION_FILTER_TABS: {
  id: ReservationFilter;
  label: string;
}[] = [
  { id: "open", label: "المفتوحة" },
  { id: "pending", label: "قيد التجهيز" },
  { id: "ready", label: "جاهزة" },
  { id: "overdue", label: "متأخرة" },
  { id: "picked_up", label: "مُستلَمة" },
  { id: "cancelled", label: "ملغاة" },
];

export const RESERVATION_STATUS_INFO: Record<
  ReservationStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "قيد التجهيز",
    className: "bg-warning/15 text-warning",
  },
  ready: { label: "جاهز للاستلام", className: "bg-primary/10 text-primary" },
  picked_up: { label: "مُستلَم", className: "bg-success/15 text-success" },
  cancelled: {
    label: "ملغى",
    className: "bg-muted text-muted-foreground",
  },
};

/** مواعيد سريعة في نافذة الحجز (بالأيام من اليوم). */
export const PICKUP_PRESETS = [
  { days: 0, label: "اليوم" },
  { days: 1, label: "غداً" },
  { days: 3, label: "بعد 3 أيام" },
  { days: 7, label: "بعد أسبوع" },
] as const;
