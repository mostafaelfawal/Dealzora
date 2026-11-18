"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { isManagement } from "@/config/roles";
import { InstallmentFormDialog } from "@/features/installments/components/installmentFormDialog";
import { useSessionUser } from "@/hooks/useShellData";
import { formatMoneyText } from "@/lib/format";
import { useFeature } from "@/lib/plan";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";

import { posUiActions, type InstallmentOffer } from "../store/posUiSlice";

const TOAST_ID = "pos-installment-offer";

/**
 * بعد بيع آجل: «قسّط هذه الفاتورة؟» (المدير مع ميزة التقسيط فقط).
 * البيع نفسه تم كاملاً (مخزون، فاتورة، ضريبة، إيصال)، والتقسيط جدول لسداد دينه.
 * الكاشير لا يرى العرض: المدير يقسّط الفاتورة لاحقاً من صفحة العميل أو صفحة التقسيط.
 */
export function PosInstallmentOffer() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const offer = useAppSelector((s) => s.posUi.installmentOffer);
  const isManager = isManagement(useSessionUser().role);
  const hasFeature = useFeature("installments");
  const canSchedule = isManager && hasFeature;
  const [active, setActive] = useState<InstallmentOffer | null>(null);

  useEffect(() => {
    if (!offer) return;
    dispatch(posUiActions.offerInstallment(null));
    if (!canSchedule) return;
    toast(`قسّط فاتورة #${offer.saleNumber}؟`, {
      id: TOAST_ID,
      description: `${formatMoneyText(offer.amount)} آجل على ${offer.customerName}`,
      duration: 15_000,
      action: {
        label: "قسّط",
        onClick: () => {
          // دين العميل تغيّر للتو: نحدّث العملاء والخطط حتى يُحسب غير المقسّط صحيحاً.
          void queryClient.invalidateQueries({ queryKey: ["customers"] });
          void queryClient.invalidateQueries({ queryKey: ["installments"] });
          setActive(offer);
        },
      },
    });
  }, [offer, canSchedule, dispatch, queryClient]);

  return (
    <InstallmentFormDialog
      open={active !== null}
      prefill={
        active
          ? {
              customerId: active.customerId,
              amount: active.amount,
              title: `فاتورة #${active.saleNumber}`,
            }
          : {}
      }
      onClose={() => setActive(null)}
    />
  );
}
