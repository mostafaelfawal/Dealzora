import type {
  OrderStatus,
  OrderStatusFilter,
  ReorderSettings,
  Urgency,
} from "../types/purchaseOrder";

export const purchaseOrderKeys = {
  all: ["purchase-orders"] as const,
  suggestions: (s: ReorderSettings) =>
    [...purchaseOrderKeys.all, "suggestions", s] as const,
  list: (status: OrderStatusFilter, page: number, pageSize: number) =>
    [...purchaseOrderKeys.all, "list", status, page, pageSize] as const,
  detail: (id: string) => [...purchaseOrderKeys.all, "detail", id] as const,
  summary: () => [...purchaseOrderKeys.all, "summary"] as const,
};

export const PURCHASE_ORDER_ROUTES = {
  list: "/admin/purchase-orders",
  /** فاتورة شراء جاهزة من الطلب (المورد والأصناف والكميات). */
  receive: (orderId: string) => `/admin/purchases/new?order=${orderId}`,
} as const;

export const DEFAULT_REORDER_SETTINGS: ReorderSettings = {
  salesDays: 30,
  coverDays: 14,
  leadDays: 3,
  roundPacks: true,
};

export const SALES_DAYS_OPTIONS = [14, 30, 60, 90] as const;
export const COVER_DAYS_OPTIONS = [7, 14, 21, 30, 45, 60] as const;
export const LEAD_DAYS_OPTIONS = [0, 1, 2, 3, 5, 7, 10, 14] as const;

export const URGENCY_INFO: Record<
  Urgency,
  { label: string; hint: string; className: string }
> = {
  out: {
    label: "نفد",
    hint: "الرصيد صفر الآن",
    className: "bg-destructive/10 text-destructive",
  },
  critical: {
    label: "حرج",
    hint: "سينفد قبل وصول طلب جديد",
    className: "bg-warning/15 text-warning",
  },
  low: {
    label: "تحت الحد",
    hint: "الرصيد أقل من الحد الأدنى",
    className: "bg-primary/10 text-primary",
  },
  soon: {
    label: "قريباً",
    hint: "سيحتاج طلباً خلال مدة التوريد",
    className: "bg-muted text-muted-foreground",
  },
};

export const STATUS_INFO: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  draft: { label: "مسودة", className: "bg-muted text-muted-foreground" },
  sent: { label: "أُرسل للمورد", className: "bg-primary/10 text-primary" },
  received: { label: "تم الاستلام", className: "bg-success/10 text-success" },
  cancelled: {
    label: "ملغي",
    className: "bg-destructive/10 text-destructive",
  },
};

export const ORDER_STATUS_TABS: { id: OrderStatusFilter; label: string }[] = [
  { id: "open", label: "مفتوحة" },
  { id: "received", label: "مستلمة" },
  { id: "cancelled", label: "ملغاة" },
  { id: "all", label: "الكل" },
];

export const ORDERS_PAGE_SIZE = 24;
export const NO_SUPPLIER = "";
