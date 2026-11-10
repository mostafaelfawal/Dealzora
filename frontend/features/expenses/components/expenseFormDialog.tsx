"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { IconDeviceFloppy, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FieldError } from "@/components/shared/form";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { EXPENSE_CATEGORIES } from "../config/expenseOptions";
import { useSaveExpense } from "../hooks/useExpenseMutations";
import { emptyValues, expenseToForm, formToInput } from "../lib/expenseForm";
import {
  expenseSchema,
  type ExpenseSchemaType,
} from "../schema/expense.schema";
import type { Expense } from "../types/expense";

const IDS = {
  amount: "ef-amount",
  date: "ef-date",
  note: "ef-note",
} as const;

/** إضافة مصروف (expense = null) أو تعديله. المحتوى يتركّب عند الفتح فقط ليبدأ الفورم نظيفاً. */
export function ExpenseFormDialog({
  open,
  expense,
  onClose,
}: {
  open: boolean;
  expense: Expense | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] gap-3 overflow-y-auto sm:max-w-lg"
      >
        {open && <ExpenseForm expense={expense} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function ExpenseForm({
  expense,
  onClose,
}: {
  expense: Expense | null;
  onClose: () => void;
}) {
  const isEditing = expense !== null;
  const save = useSaveExpense();
  const [pendingAction, setPendingAction] = useState<"save" | "saveAndNew">(
    "save",
  );

  const form = useForm<ExpenseSchemaType>({
    resolver: zodResolver(expenseSchema),
    mode: "onTouched",
    defaultValues: expense ? expenseToForm(expense) : emptyValues(),
  });
  const {
    register,
    setValue,
    handleSubmit,
    reset,
    setFocus,
    control,
    formState: { errors },
  } = form;
  const category = useWatch({ control, name: "category" });
  const saving = save.isPending;

  function submit(andNew: boolean) {
    if (saving) return;
    setPendingAction(andNew ? "saveAndNew" : "save");
    void handleSubmit((values) =>
      save.mutate(
        {
          input: formToInput(values),
          id: expense?.id,
          baseVersion: expense?.version,
        },
        {
          onSuccess: () => {
            if (andNew) {
              reset(emptyValues());
              setFocus("amount");
            } else onClose();
          },
        },
      ),
    )();
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit(false);
      }}
      className="space-y-4"
    >
      <DialogHeader className="text-start">
        <DialogTitle>{isEditing ? "تعديل مصروف" : "مصروف جديد"}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? "عدّل بيانات المصروف ثم احفظ."
            : "اختر النوع واكتب المبلغ. الباقي اختياري."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label>نوع المصروف *</Label>
        <div
          role="group"
          aria-label="نوع المصروف"
          className="grid grid-cols-2 gap-1.5 sm:grid-cols-3"
        >
          {EXPENSE_CATEGORIES.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              disabled={saving}
              variant={category === item.id ? "default" : "outline"}
              aria-pressed={category === item.id}
              onClick={() =>
                setValue("category", item.id, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              className="font-normal"
            >
              {item.label}
            </Button>
          ))}
        </div>
        <FieldError id="ef-category-error" message={errors.category?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={IDS.amount}>المبلغ (ج.م) *</Label>
          <Input
            id={IDS.amount}
            {...register("amount")}
            dir="ltr"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={`${IDS.amount}-error`}
            disabled={saving}
            placeholder="0"
            className="font-mono"
          />
          <FieldError
            id={`${IDS.amount}-error`}
            message={errors.amount?.message}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={IDS.date}>التاريخ *</Label>
          <Input
            id={IDS.date}
            {...register("spentAt")}
            type="date"
            dir="ltr"
            aria-invalid={Boolean(errors.spentAt)}
            aria-describedby={`${IDS.date}-error`}
            disabled={saving}
            className="font-mono"
          />
          <FieldError
            id={`${IDS.date}-error`}
            message={errors.spentAt?.message}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={IDS.note}>ملاحظة</Label>
        <Input
          id={IDS.note}
          {...register("note")}
          autoComplete="off"
          aria-invalid={Boolean(errors.note)}
          aria-describedby={`${IDS.note}-error`}
          disabled={saving}
          placeholder="مثال: إيجار شهر نوفمبر"
        />
        <FieldError id={`${IDS.note}-error`} message={errors.note?.message} />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={saving}
          onClick={onClose}
          className="gap-2 font-normal sm:me-auto"
        >
          إلغاء
          <ShortcutBadge className="hidden rounded-none lg:inline-flex">
            Esc
          </ShortcutBadge>
        </Button>

        {!isEditing && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={saving}
            onClick={() => submit(true)}
            className="gap-2 font-normal"
          >
            {saving && pendingAction === "saveAndNew" ? (
              <>
                <IconLoader2 className="size-4 animate-spin" aria-hidden />
                جارٍ الحفظ…
              </>
            ) : (
              "حفظ وإضافة آخر"
            )}
          </Button>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={saving}
          className="gap-2 px-5"
        >
          {saving && pendingAction === "save" ? (
            <>
              <IconLoader2 className="size-4 animate-spin" aria-hidden />
              جارٍ الحفظ…
            </>
          ) : (
            <>
              <IconDeviceFloppy className="size-4" aria-hidden />
              {isEditing ? "حفظ التعديلات" : "حفظ المصروف"}
              <ShortcutBadge className="hidden rounded-none border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
                Enter
              </ShortcutBadge>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
