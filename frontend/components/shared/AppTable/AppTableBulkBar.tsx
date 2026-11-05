"use client";

import { IconEyeOff, IconLoader2, IconTrash, IconX } from "@tabler/icons-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { AppTableBulkActions } from "./types";

interface Props<T> {
  rows: T[];
  actions: AppTableBulkActions<T>;
  onClear: () => void;
}

export function AppTableBulkBar<T>({ rows, actions, onClear }: Props<T>) {
  const {
    onDelete,
    onDeactivate,
    confirmDelete = true,
    isPending,
    itemLabel = "عنصر",
  } = actions;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);
  const count = rows.length;

  function runDelete() {
    setConfirmOpen(false);
    onDelete?.(rows, onClear);
  }

  return (
    <>
      <div
        role="region"
        aria-label="إجراءات جماعية"
        className="sticky bottom-3 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 border bg-background p-2 shadow-lg animate-in fade-in slide-in-from-bottom-2"
      >
        <span aria-live="polite" className="px-2 text-xs">
          تم تحديد{" "}
          <bdi dir="ltr" className="font-mono font-semibold tabular-nums">
            {count}
          </bdi>
        </span>

        {onDeactivate && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => onDeactivate(rows, onClear)}
            className="gap-1.5 font-normal"
          >
            <IconEyeOff className="size-4" />
            تعطيل
          </Button>
        )}

        {onDelete && (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => (confirmDelete ? setConfirmOpen(true) : runDelete())}
            className="gap-1.5"
          >
            {isPending ? (
              <IconLoader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <IconTrash className="size-4" />
            )}
            حذف
          </Button>
        )}

        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="إلغاء التحديد"
          disabled={isPending}
          onClick={onClear}
          className="size-8"
        >
          <IconX />
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          showCloseButton={false}
          initialFocus={backRef}
          className="sm:max-w-sm"
        >
          <DialogHeader className="text-start">
            <DialogTitle>
              حذف {count} {itemLabel}؟
            </DialogTitle>
            <DialogDescription>
              لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              ref={backRef}
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setConfirmOpen(false)}
            >
              رجوع
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="lg"
              onClick={runDelete}
            >
              <IconTrash />
              تأكيد الحذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
