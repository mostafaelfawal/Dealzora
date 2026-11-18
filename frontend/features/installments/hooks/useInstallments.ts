import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";
import { formatMoneyText } from "@/lib/format";

import {
  cancelPlan,
  createPlan,
  fetchPlan,
  fetchPlans,
  fetchPlansSummary,
  payInstallment,
} from "../api/installments.api";
import type { InstallmentPlan } from "../types/installment";

export const installmentKeys = {
  all: ["installments"] as const,
  list: () => [...installmentKeys.all, "list"] as const,
  summary: () => [...installmentKeys.all, "summary"] as const,
  detail: (id: string) => [...installmentKeys.all, "detail", id] as const,
};

/** القائمة كاملة مرة واحدة، والفلترة والبحث على جهة الواجهة (عدد الخطط صغير). */
export const usePlans = () =>
  useQuery({ queryKey: installmentKeys.list(), queryFn: () => fetchPlans() });

export const usePlansSummary = (opts: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: installmentKeys.summary(),
    queryFn: fetchPlansSummary,
    enabled: opts.enabled ?? true,
    // التأخر يتغيّر بمرور الأيام لا بالبيانات فقط: إعادة فحص كل نصف ساعة.
    refetchInterval: 30 * 60_000,
  });

export const usePlan = (id: string | null) =>
  useQuery({
    queryKey: installmentKeys.detail(id ?? ""),
    queryFn: () => fetchPlan(id as string),
    enabled: id !== null,
  });

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: installmentKeys.all });
    // التقسيط يغيّر رصيد العميل وكشفه والخزنة.
    void qc.invalidateQueries({ queryKey: ["customers"] });
    void qc.invalidateQueries({ queryKey: ["treasury"] });
  };
}

export function useCreatePlan() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: createPlan,
    onSuccess: (p) => {
      refresh();
      toast.success(`خطة «${p.title}» جاهزة`, {
        description: `${p.installmentsCount} قسط × ${formatMoneyText(p.installmentAmount)} على ${p.customerName}.`,
      });
    },
    onError: (e) =>
      toast.error(extractErrorMessage(e, "تعذّر إنشاء خطة التقسيط")),
  });
}

export function usePayInstallment() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: { id: string; amount: number; note: string }) =>
      payInstallment(v.id, { amount: v.amount, note: v.note }),
    onSuccess: (p, v) => {
      refresh();
      toast.success(`تم تحصيل ${formatMoneyText(v.amount)}`, {
        description:
          p.status === "completed"
            ? `اكتملت خطة «${p.title}» بالكامل.`
            : `المتبقي على ${p.customerName}: ${formatMoneyText(p.remaining)}.`,
      });
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر تسجيل القسط")),
  });
}

export function useCancelPlan() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (p: InstallmentPlan) => cancelPlan(p),
    onSuccess: (p) => {
      refresh();
      toast.success(`أُلغيت خطة «${p.title}»`, {
        description: "المتبقي بقي ديناً عادياً في حساب العميل.",
      });
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر إلغاء الخطة")),
  });
}
