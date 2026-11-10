import type { TrendMetric } from "../types/dashboard";

export const TREND_METRICS: { id: TrendMetric; label: string }[] = [
  { id: "net", label: "صافي المبيعات" },
  { id: "profit", label: "مجمل الربح" },
  { id: "invoices", label: "عدد الفواتير" },
];

/** بعد هذا العدد من الأيام تُكتب التسميات كتاريخ مختصر بدل اسم اليوم. */
export const SHORT_DATE_THRESHOLD = 10;

/** نطاق الساعات الافتراضي لمخطط "حسب الساعة" عند غياب المبيعات. */
export const DEFAULT_HOURS = { from: 9, to: 22 } as const;
