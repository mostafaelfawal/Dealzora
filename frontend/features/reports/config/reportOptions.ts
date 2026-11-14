import type { PlanFeature } from "@/lib/plan";

import type {
  ProductRank,
  PromoStatus,
  ReportTab,
  SalesMetric,
} from "../types/report";

/** feature: التبويب يظهر فقط لو الميزة في خطة المحل (الـ backend يرفضه على أي حال). */
export const REPORT_TABS: {
  id: ReportTab;
  label: string;
  feature?: PlanFeature;
}[] = [
  { id: "sales", label: "المبيعات والأرباح" },
  { id: "products", label: "الأصناف والأقسام" },
  { id: "purchases", label: "المشتريات", feature: "suppliers" },
  { id: "promotions", label: "العروض" },
  { id: "returns", label: "المرتجعات" },
  { id: "customers", label: "العملاء والنقاط", feature: "customers" },
  { id: "cashiers", label: "الكاشيرية والورديات" },
  { id: "stock", label: "النواقص والراكد" },
  { id: "debts", label: "المديونيات" },
  { id: "treasury", label: "الخزنة" },
];

/** التبويبات التي تعتمد على الفترة (الباقي لقطة "الآن"). */
export const PERIOD_TABS: ReadonlySet<ReportTab> = new Set([
  "sales",
  "products",
  "purchases",
  "promotions",
  "returns",
  "customers",
  "cashiers",
  "treasury",
  "branches",
]);

export const PROMO_STATUS_LABEL: Record<PromoStatus, string> = {
  active: "ساري",
  scheduled: "مجدول",
  expired: "انتهى",
  paused: "موقوف",
};

/** فلتر القسم في تقرير الأصناف: الكل، أو قسم، أو "بدون قسم". */
export const ALL_CATEGORIES = "__all__";

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
