"use client";

import { IconTrash } from "@tabler/icons-react";
import { useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * تأكيد قبل إجراء لا يمكن التراجع عنه (حذف غالباً).
 * التركيز الافتراضي على «رجوع» (الأكثر أماناً)، فلا يُنفَّذ شيء بضغطة Enter خاطئة.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  /** نص زر التأكيد بأثره، مثل «حذف الصنف». */
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const backRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        initialFocus={backRef}
        className="sm:max-w-sm"
      >
        <DialogHeader className="text-start">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            ref={backRef}
            type="button"
            variant="outline"
            size="lg"
            onClick={onClose}
          >
            رجوع
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <IconTrash />
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
