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

interface PosCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  total: number;
  onConfirm: () => void;
}

/** تأكيد الإلغاء: يبيّن ما الذي سيُحذف، والتركيز الافتراضي على "رجوع" (الأكثر أماناً). */
export function PosCancelDialog({
  open,
  onOpenChange,
  itemCount,
  total,
  onConfirm,
}: PosCancelDialogProps) {
  const backRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            onClick={onConfirm}
          >
            إلغاء الفاتورة
          </Button>
          <Button
            ref={backRef}
            type="button"
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            رجوع
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
