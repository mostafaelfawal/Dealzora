"use client";

import { useRef } from "react";

import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { confirmCancel } from "../store/posActions";
import { posUiActions } from "../store/posUiSlice";
import { selectTotals } from "../store/selectors";

/** تأكيد الإلغاء: يبيّن ما الذي سيُحذف، والتركيز الافتراضي على "رجوع" (الأكثر أماناً). */
export function PosCancelDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.posUi.dialog === "cancel");
  const { itemCount, total } = useAppSelector(selectTotals);
  const backRef = useRef<HTMLButtonElement>(null);

  const close = () => dispatch(posUiActions.closeDialog());

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        showCloseButton={false}
        initialFocus={backRef}
        className="sm:max-w-sm"
      >
        <DialogHeader className="text-start">
          <DialogTitle>إلغاء الفاتورة؟</DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="block">
              سيتم حذف {itemCount} صنف من الفاتورة الحالية بإجمالي{" "}
              <Money amount={total} className="inline-flex text-xs" />.
            </span>
            <span className="block">
              لن يتم حفظها في أي مكان ولا يمكن استرجاعها. إذا أردتها لاحقاً
              فاستخدم التعليق (F4).
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="destructive"
            size="lg"
            onClick={() => dispatch(confirmCancel())}
          >
            إلغاء الفاتورة
          </Button>
          <Button
            ref={backRef}
            type="button"
            variant="outline"
            size="lg"
            onClick={close}
          >
            رجوع
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
