import {
  IconAlertTriangle,
  IconBuildingStore,
  IconCash,
  IconChartLine,
  IconDiscount,
  IconPackage,
  IconReceiptRefund,
  IconScale,
  IconTruckDelivery,
  IconUserDollar,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";

import type { PlanFeature } from "@/lib/plan";

import type {
  ProductRank,
  PromoStatus,
  ReportTab,
  SalesMetric,
} from "../types/report";

export type ReportGroup = "selling" | "goods" | "people" | "money";

/** مجموعات التقارير بالسؤال الذي يدور في ذهن التاجر، بترتيب الأهمية. */
export const REPORT_GROUPS: { id: ReportGroup; label: string }[] = [
  { id: "selling", label: "البيع" },
  { id: "goods", label: "البضاعة" },
  { id: "people", label: "العملاء والموظفون" },
  { id: "money", label: "الأموال" },
];

export interface ReportTabOption {
  id: ReportTab;
  label: string;
  /** السؤال الذي يجيب عنه التقرير (يظهر تحت اسمه في القائمة وفي رأسه). */
  hint: string;
  group: ReportGroup;
  icon: Icon;
  /** التبويب يظهر فقط لو الميزة في خطة المحل (الـ backend يرفضه على أي حال). */
  feature?: PlanFeature;
}

export const REPORT_TABS: ReportTabOption[] = [
  {
    id: "sales",
    label: "المبيعات والأرباح",
    hint: "كم بعت وكم كسبت؟",
    group: "selling",
    icon: IconChartLine,
  },
  {
    id: "products",
    label: "الأصناف والأقسام",
    hint: "ما الأصناف الأكثر مبيعاً وربحاً؟",
    group: "selling",
    icon: IconPackage,
  },
  {
    id: "promotions",
    label: "العروض",
    hint: "هل حققت العروض مبيعات؟",
    group: "selling",
    icon: IconDiscount,
    feature: "promotions",
  },
  {
    id: "returns",
    label: "المرتجعات",
    hint: "ما الذي يُرتجع، ولماذا؟",
    group: "selling",
    icon: IconReceiptRefund,
  },
  {
    id: "stock",
    label: "النواقص والراكد",
    hint: "ماذا أطلب، وما الراكد؟",
    group: "goods",
    icon: IconAlertTriangle,
  },
  {
    id: "purchases",
    label: "المشتريات",
    hint: "بكم اشتريت، وممّن؟",
    group: "goods",
    icon: IconTruckDelivery,
    feature: "suppliers",
  },
  {
    id: "customers",
    label: "العملاء والنقاط",
    hint: "مَن أهم عملائك؟",
    group: "people",
    icon: IconUsers,
    feature: "customers",
  },
  {
    id: "cashiers",
    label: "الكاشيرية والورديات",
    hint: "ما أداء كل كاشير في ورديته؟",
    group: "people",
    icon: IconUserDollar,
  },
  {
    id: "treasury",
    label: "الخزنة",
    hint: "كيف دخلت الأموال وخرجت؟",
    group: "money",
    icon: IconCash,
  },
  {
    id: "debts",
    label: "المديونيات",
    hint: "كم لك، وكم عليك؟",
    group: "money",
    icon: IconScale,
    feature: "full_reports",
  },
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
export const BRANCHES_TAB: ReportTabOption = {
  id: "branches",
  label: "كل الفروع",
  hint: "كيف تتقارن الفروع فيما بينها؟",
  group: "money",
  icon: IconBuildingStore,
};

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
