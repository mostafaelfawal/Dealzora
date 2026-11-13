import type { ProductRank, ReportTab, SalesMetric } from "../types/report";

export const REPORT_TABS: { id: ReportTab; label: string }[] = [
  { id: "sales", label: "المبيعات والأرباح" },
  { id: "products", label: "الأصناف" },
  { id: "stock", label: "النواقص والراكد" },
  { id: "debts", label: "المديونيات" },
  { id: "treasury", label: "الخزنة" },
];

/** التبويبات التي تعتمد على الفترة (الباقي لقطة "الآن"). */
export const PERIOD_TABS: ReadonlySet<ReportTab> = new Set([
  "sales",
  "products",
  "treasury",
  "branches",
]);

/** تبويب يظهر للمالك على الجهاز الرئيسي المربوط بسيرفر الفروع فقط. */
export const BRANCHES_TAB = { id: "branches" as const, label: "كل الفروع" };

export const PRODUCT_RANKS: {
  id: ProductRank;
  label: string;
  valueLabel: string;
}[] = [
  { id: "top", label: "الأكثر مبيعاً", valueLabel: "الكمية" },
  { id: "profit", label: "الأعلى ربحاً", valueLabel: "الربح" },
  { id: "revenue", label: "الأعلى إيراداً", valueLabel: "الإيراد" },
  { id: "bottom", label: "الأقل مبيعاً", valueLabel: "الكمية" },
];

export const SALES_METRICS: { id: SalesMetric; label: string }[] = [
  { id: "net", label: "صافي المبيعات" },
  { id: "profit", label: "مجمل الربح" },
  { id: "count", label: "عدد الفواتير" },
];

export const REPORT_LIMITS = {
  /** عدد الأصناف المطلوبة من الخادم في تقرير الأصناف. */
  products: 30,
  /** أعمدة الرسم في تقرير الأصناف (الجدول فيه الكل). */
  productsChart: 12,
  /** أيام بلا بيع حتى يُعد الصنف راكداً. */
  stagnantDays: 30,
  /** صفوف كل قائمة في تبويب المخزون. */
  stockList: 15,
  /** أعمدة رسوم "الأكبر" (راكد، مدينون). */
  topChart: 10,
} as const;

/** بعد هذا العدد من الأيام تُكتب التسميات كتاريخ مختصر. */
export const SHORT_DATE_THRESHOLD = 10;
