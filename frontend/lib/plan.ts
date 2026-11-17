import { useQuery } from "@tanstack/react-query";

import { api } from "./axios";
import { FEATURE_INFO, type PlanFeature } from "@/config/planFeatures";

export { FEATURE_INFO, type PlanFeature };

/**
 * خطة المحل من الـ backend (GET /plan). الـ backend هو من يفرض الحدود فعلاً؛
 * هنا فقط لنقفل الأزرار ونعرض رسالة الترقية قبل أن يجرب المستخدم.
 */

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

/** «خطتك الحالية …» بالاسم الفعلي (لا نفترض «بَسطة»: مستخدم «دُكّان» يرى ميزات «سوق» مقفولة). */
export function currentPlanLabel(plan: PlanInfo | null = cached): string {
  if (!plan || plan.isFree) return "«بَسطة» المجانية";
  return `«${plan.name}»`;
}

export function upgradeMessage(feature: PlanFeature): string {
  const f = FEATURE_INFO[feature];
  return `${f.name} متاحة من خطة «${f.plan}». خطتك الحالية ${currentPlanLabel()}.`;
}
