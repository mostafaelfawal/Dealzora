"use client";

import { IconLoader2 } from "@tabler/icons-react";
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

import { useDeleteExpense } from "../hooks/useExpenseMutations";
import { categoryLabel, formatDate } from "../lib/expenseCalc";
import type { Expense } from "../types/expense";

/** حذف مصروف. التركيز الافتراضي على "رجوع" (الأكثر أماناً). */
export function DeleteExpenseDialog({
  expense,
  onClose,
}: {
  expense: Expense | null;
  onClose: () => void;
}) {
  const remove = useDeleteExpense();
  const backRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog open={expense !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        initialFocus={backRef}
        className="sm:max-w-sm"
      >
        <DialogHeader className="text-start">
          <DialogTitle>حذف هذا المصروف؟</DialogTitle>
          <DialogDescription className="space-y-1">
            {expense && (
              <span className="flex flex-wrap items-baseline gap-1">
                {categoryLabel(expense.category)} ·{" "}
                {formatDate(expense.spentAt)} ·{" "}
                <Money amount={expense.amount} className="inline-flex text-xs" />
              </span>
            )}
            <span className="block">
              سيُخصم من مصاريف الفترة وتتحدّث حركة الخزنة.
            </span>
          </DialogDescription>
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
            disabled={remove.isPending || !expense}
            onClick={() =>
              expense &&
              remove.mutate(
                { id: expense.id, version: expense.version },
                { onSuccess: onClose },
              )
            }
            className="gap-2"
          >
            {remove.isPending && <IconLoader2 className="size-4 animate-spin" />}
            حذف المصروف
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}