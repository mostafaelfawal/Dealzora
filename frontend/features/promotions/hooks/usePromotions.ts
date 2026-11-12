import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";

import {
  createPromotion,
  deletePromotion,
  fetchPromotions,
  fetchPromotionsSummary,
  togglePromotion,
  updatePromotion,
} from "../api/promotions.api";
import type { Promotion, PromotionInput } from "../types/promotion";

export const promotionKeys = {
  all: ["promotions"] as const,
  list: () => [...promotionKeys.all, "list"] as const,
  summary: () => [...promotionKeys.all, "summary"] as const,
};

export const usePromotions = () =>
  useQuery({ queryKey: promotionKeys.list(), queryFn: fetchPromotions });

export const usePromotionsSummary = () =>
  useQuery({
    queryKey: promotionKeys.summary(),
    queryFn: fetchPromotionsSummary,
  });

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: promotionKeys.all });
    // الكاشير على نفس الجهاز يتحدث فوراً (والأجهزة الأخرى بالمزامنة اللحظية).
    void qc.invalidateQueries({ queryKey: ["pos", "catalog", "promotions"] });
  };
}

export function useSavePromotion() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: { promotion: Promotion | null; input: PromotionInput }) =>
      v.promotion
        ? updatePromotion(v.promotion, v.input)
        : createPromotion(v.input),
    onSuccess: (p, v) => {
      refresh();
      toast.success(
        v.promotion ? `تم حفظ «${p.name}»` : `العرض «${p.name}» جاهز`,
        {
          description:
            p.status === "active"
              ? "يُطبَّق في الكاشير تلقائياً من الآن."
              : p.status === "scheduled"
                ? "سيبدأ تلقائياً في تاريخ البداية."
                : undefined,
        },
      );
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر حفظ العرض")),
  });
}

export function useTogglePromotion() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: togglePromotion,
    onSuccess: (p) => {
      refresh();
      toast.success(p.isActive ? `شغّلت «${p.name}»` : `أوقفت «${p.name}»`);
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر تحديث العرض")),
  });
}

export function useDeletePromotion() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: deletePromotion,
    onSuccess: (_r, p) => {
      refresh();
      toast.success(`حُذف «${p.name}»`);
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر حذف العرض")),
  });
}
