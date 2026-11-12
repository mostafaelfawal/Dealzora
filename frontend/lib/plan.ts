import { useQuery } from "@tanstack/react-query";

import { api } from "./axios";

/**
 * خطة المحل من الـ backend (GET /plan). الـ backend هو من يفرض الحدود فعلاً؛
 * هنا فقط لنقفل الأزرار ونعرض رسالة الترقية قبل أن يجرب المستخدم.
 */
export type PlanFeature =
  | "customers"
  | "suppliers"
  | "expenses"
  | "extra_units"
  | "barcode_labels"
  | "excel"
  | "whatsapp"
  | "backup_location"
  | "audit_log"
  | "full_reports"
  | "multi_user"
  | "terminals";

export interface PlanInfo {
  plan: "free" | "basic" | "pro" | "enterprise";
  /** بَسطة / دُكّان / سوق / سلسلة */
  name: string;
  isFree: boolean;
  features: PlanFeature[];
  limits: {
    products: number | null;
    users: number | null;
    reportDays: number | null;
  };
}

/** اسم الميزة في رسالة الترقية + أقل خطة تفتحها (نفس backend/app/core/plan.py). */
export const FEATURE_INFO: Record<PlanFeature, { name: string; plan: string }> =
  {
    customers: { name: "العملاء والبيع الآجل", plan: "دُكّان" },
    suppliers: { name: "الموردين والمشتريات", plan: "دُكّان" },
    expenses: { name: "المصروفات والخزنة", plan: "دُكّان" },
    extra_units: { name: "وحدات البيع الإضافية (كرتونة/دستة)", plan: "دُكّان" },
    barcode_labels: { name: "طباعة ملصقات الباركود", plan: "دُكّان" },
    excel: { name: "الاستيراد والتصدير من Excel", plan: "دُكّان" },
    whatsapp: { name: "إرسال الفاتورة على واتساب", plan: "دُكّان" },
    backup_location: {
      name: "اختيار مكان النسخ والاستعادة من ملف",
      plan: "دُكّان",
    },
    audit_log: { name: "سجل العمليات", plan: "سوق" },
    full_reports: { name: "التقارير الكاملة", plan: "دُكّان" },
    multi_user: { name: "أكثر من مستخدم", plan: "دُكّان" },
    terminals: { name: "أجهزة كاشير إضافية", plan: "سوق" },
  };

interface PlanDto {
  plan: PlanInfo["plan"];
  name: string;
  is_free: boolean;
  features: PlanFeature[];
  limits: {
    products: number | null;
    users: number | null;
    report_days: number | null;
  };
}

// آخر خطة معروفة لاستخدامها خارج React (طباعة الإيصال).
let cached: PlanInfo | null = null;
export const getCachedPlan = () => cached;

export async function fetchPlan(): Promise<PlanInfo> {
  const { data } = await api.get<PlanDto>("/plan");
  cached = {
    plan: data.plan,
    name: data.name,
    isFree: data.is_free,
    features: data.features,
    limits: {
      products: data.limits.products,
      users: data.limits.users,
      reportDays: data.limits.report_days,
    },
  };
  return cached;
}

export const planKey = ["plan"] as const;

export function usePlan() {
  return useQuery({
    queryKey: planKey,
    queryFn: fetchPlan,
    staleTime: 5 * 60_000,
    // الاشتراك قد ينتهي والبرنامج مفتوح: الـ backend يرجع لـ«بَسطة» فوراً، والواجهة خلال دقائق.
    refetchInterval: 5 * 60_000,
  });
}

/**
 * هل الميزة متاحة؟ أثناء التحميل نعتبرها متاحة (لا نومض قفلاً على عميل مدفوع)،
 * والـ backend يرفض على أي حال لو لم تكن.
 */
export function useFeature(feature: PlanFeature): boolean {
  const { data } = usePlan();
  return !data || data.features.includes(feature);
}

export function upgradeMessage(feature: PlanFeature): string {
  const f = FEATURE_INFO[feature];
  return `${f.name} متاحة من خطة «${f.plan}». خطتك الحالية «بَسطة» المجانية.`;
}
