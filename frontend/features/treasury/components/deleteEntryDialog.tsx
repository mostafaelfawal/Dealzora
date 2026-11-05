"use client";

import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useDeleteCashEntry } from "../hooks/useTreasuryMutations";
import type { CashEntry } from "../types/treasury";
import { TreasuryAmount } from "./treasuryAmount";

/** حذف حركة يدوية: يعدّل الرصيد بعكسها. التركيز الافتراضي على "رجوع" (الأكثر أماناً). */
export function DeleteEntryDialog({
  entry,
  onClose,
}: {
  entry: CashEntry | null;
  onClose: () => void;
}) {
  const remove = useDeleteCashEntry();
  const backRef = useRef<HTMLButtonElement>(null);
  const blocked = entry?.isLinked ?? false;

  return (
    <Dialog open={entry !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        initialFocus={backRef}
        className="sm:max-w-sm"
      >
        <DialogHeader className="text-start">
          <DialogTitle>حذف هذه الحركة؟</DialogTitle>
          <DialogDescription className="space-y-1.5">
            {entry && blocked ? (
              <span className="flex items-start gap-2 text-destructive">
                <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  هذه الحركة مرتبطة بعملية أخرى (مثل مصروف). عدّلها أو احذفها من
                  مصدرها.
                </span>
              </span>
            ) : (
              entry && (
                <>
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 truncate">
                      {entry.note || "بدون ملاحظة"}
                    </span>
                    <TreasuryAmount
                      direction={entry.direction}
                      amount={entry.amount}
                      className="text-xs"
                    />
                  </span>
                  <span className="block">
                    سيتغيّر رصيد الخزنة بعكس هذه الحركة، ويبقى الحذف مسجّلاً في
                    سجل العمليات.
                  </span>
                </>
              )
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {!blocked && (
            <Button
              type="button"
              variant="destructive"
              size="lg"
              disabled={remove.isPending || !entry}
              onClick={() =>
                entry &&
                remove.mutate(
                  { id: entry.id, version: entry.version },
                  { onSuccess: onClose },
                )
              }
              className="gap-2"
            >
              {remove.isPending && (
                <IconLoader2 className="size-4 animate-spin" />
              )}
              حذف الحركة
            </Button>
          )}
          <Button
            ref={backRef}
            type="button"
            variant="outline"
            size="lg"
            onClick={onClose}
          >
            رجوع
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
