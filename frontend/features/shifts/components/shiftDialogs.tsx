"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Shift } from "../types/shift";
import { CloseShiftForm } from "./closeShiftForm";
import { OpenShiftForm } from "./openShiftForm";

export function OpenShiftDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="gap-4 sm:max-w-sm">
        <DialogHeader className="text-start">
          <DialogTitle>فتح وردية جديدة</DialogTitle>
          <DialogDescription>
            عدّ الفكّة الموجودة في الدرج واكتبها، ثم ابدأ البيع.
          </DialogDescription>
        </DialogHeader>
        {open && <OpenShiftForm onDone={onClose} onCancel={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

/**
 * قفل الوردية بعدّ "أعمى": الكاشير يعدّ العملات ولا يرى المتوقع،
 * والمدير يرى المتوقع والفرق مباشرة.
 */
export function CloseShiftDialog({
  shift,
  open,
  onClose,
  onClosed,
}: {
  shift: Shift | null;
  open: boolean;
  onClose: () => void;
  onClosed?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[92dvh] gap-3 overflow-y-auto sm:max-w-md"
      >
        {open && shift && (
          <CloseShiftForm
            shift={shift}
            onCancel={onClose}
            onDone={() => {
              onClose();
              onClosed?.();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
