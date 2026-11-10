"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  IconAlertTriangle,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconDeviceFloppy,
  IconLoader2,
} from "@tabler/icons-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FieldError } from "@/components/shared/form";
import { Money } from "@/components/shared/Money";
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
import { Separator } from "@/components/ui/separator";
import { round2 } from "@/features/pos/lib/posCalc";

import { NOTE_PRESETS } from "../config/treasuryOptions";
import { useCreateManualEntry } from "../hooks/useTreasuryMutations";
import { amountOrZero, parseAmount } from "../lib/treasuryCalc";
import { emptyTreasuryForm, formToInput } from "../lib/treasuryForm";
import {
  treasurySchema,
  type TreasurySchemaType,
} from "../schema/treasury.schema";
import type { CashDirection } from "../types/treasury";
import { CurrencyLabel } from "@/components/shared/CurrencyLabel";

const IDS = {
  amount: "tf-amount",
  date: "tf-date",
  note: "tf-note",
} as const;

/** إيداع أو سحب يدوي. المحتوى يتركّب عند الفتح فقط ليبدأ الفورم نظيفاً. */
export function ManualEntryDialog({
  open,
  direction,
  balance,
  onClose,
}: {
  open: boolean;
  direction: CashDirection;
  /** رصيد الخزنة الحالي، لعرض الرصيد بعد الحركة. */
  balance: number;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] gap-3 overflow-y-auto sm:max-w-md"
      >
        {open && (
          <ManualEntryForm
            initialDirection={direction}
            balance={balance}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ManualEntryForm({
  initialDirection,
  balance,
  onClose,
}: {
  initialDirection: CashDirection;
  balance: number;
  onClose: () => void;
}) {
  const save = useCreateManualEntry();
  const [pendingAction, setPendingAction] = useState<"save" | "saveAndNew">(
    "save",
  );

  const form = useForm<TreasurySchemaType>({
    resolver: zodResolver(treasurySchema),
    mode: "onTouched",
    defaultValues: emptyTreasuryForm(initialDirection),
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
  const [direction, amountText, note] = useWatch({
    control,
    name: ["direction", "amount", "note"],
  });

  const isIn = direction === "in";
  const amount = amountOrZero(parseAmount(amountText));
  const after = round2(balance + (isIn ? amount : -amount));
  const saving = save.isPending;

  function submit(andNew: boolean) {
    if (saving) return;
    setPendingAction(andNew ? "saveAndNew" : "save");
    void handleSubmit((values) =>
      save.mutate(formToInput(values), {
        onSuccess: () => {
          if (andNew) {
            reset(emptyTreasuryForm(values.direction));
            setFocus("amount");
          } else onClose();
        },
      }),
    )();
  }

  const directions: {
    id: CashDirection;
    label: string;
    icon: typeof IconArrowDownLeft;
  }[] = [
    { id: "in", label: "إيداع", icon: IconArrowDownLeft },
    { id: "out", label: "سحب", icon: IconArrowUpRight },
  ];

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
        <DialogTitle>حركة جديدة في الخزنة</DialogTitle>
        <DialogDescription>
          للإيداع أو السحب اليدوي فقط (رصيد افتتاحي، تمويل، سحب المالك).
          المبيعات والمشتريات والمصروفات والتحصيل تدخل الخزنة تلقائياً.
        </DialogDescription>
      </DialogHeader>

      <div
        role="group"
        aria-label="نوع الحركة"
        className="grid grid-cols-2 gap-2"
      >
        {directions.map((d) => (
          <Button
            key={d.id}
            type="button"
            size="lg"
            variant={direction === d.id ? "default" : "outline"}
            aria-pressed={direction === d.id}
            disabled={saving}
            onClick={() => setValue("direction", d.id, { shouldDirty: true })}
            className="gap-2 font-normal"
          >
            <d.icon className="size-4" />
            {d.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={IDS.amount}>المبلغ (<CurrencyLabel />) *</Label>
          <Input
            id={IDS.amount}
            {...register("amount")}
            autoFocus
            dir="ltr"
            inputMode="decimal"
            autoComplete="off"
            maxLength={12}
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
            type="date"
            {...register("occurredOn")}
            dir="ltr"
            aria-invalid={Boolean(errors.occurredOn)}
            aria-describedby={`${IDS.date}-error`}
            disabled={saving}
            className="font-mono"
          />
          <FieldError
            id={`${IDS.date}-error`}
            message={errors.occurredOn?.message}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={IDS.note}>السبب *</Label>
        <Input
          id={IDS.note}
          {...register("note")}
          autoComplete="off"
          aria-invalid={Boolean(errors.note)}
          aria-describedby={`${IDS.note}-error`}
          disabled={saving}
          placeholder="مثال: رصيد افتتاحي"
        />
        <FieldError id={`${IDS.note}-error`} message={errors.note?.message} />
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {NOTE_PRESETS[direction].map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={note === preset ? "default" : "outline"}
              aria-pressed={note === preset}
              disabled={saving}
              onClick={() =>
                setValue("note", preset, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              className="font-normal"
            >
              {preset}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      <dl aria-live="polite" className="space-y-1 text-xs">
        <div className="flex items-end justify-between">
          <dt className="pb-0.5 text-sm font-medium">رصيد الخزنة بعد الحركة</dt>
          <dd>
            <Money
              amount={after}
              className={
                after < 0
                  ? "text-2xl leading-none text-destructive"
                  : "text-2xl leading-none"
              }
            />
          </dd>
        </div>
      </dl>

      {!isIn && amount > balance && (
        <p
          role="status"
          className="flex items-center gap-2 text-xs text-warning"
        >
          <IconAlertTriangle className="size-4 shrink-0" />
          المبلغ أكبر من رصيد الخزنة الحالي، وسيصبح الرصيد سالباً.
        </p>
      )}

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
            "حفظ وإضافة أخرى"
          )}
        </Button>

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
              {isIn ? "تسجيل الإيداع" : "تسجيل السحب"}
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
