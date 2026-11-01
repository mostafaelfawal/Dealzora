"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";

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
import { formatMoneyText, normalizeDigits, round2 } from "../lib/posCalc";
import type { InvoiceDiscount } from "../types/pos";

type Mode = "amount" | "percent" | "final";

const MODES: { id: Mode; label: string }[] = [
  { id: "amount", label: "مبلغ" },
  { id: "percent", label: "نسبة %" },
  { id: "final", label: "الإجمالي النهائي" },
];

interface PosDiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subtotal: number;
  current: InvoiceDiscount | null;
  onApply: (discount: InvoiceDiscount) => void;
  onRemove: () => void;
}

export function PosDiscountDialog({
  open,
  onOpenChange,
  ...formProps
}: PosDiscountDialogProps) {
  const valueInputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        initialFocus={valueInputRef}
        className="gap-3 sm:max-w-sm"
      >
        <DialogHeader className="text-start">
          <DialogTitle>خصم على الفاتورة</DialogTitle>
          <DialogDescription>
            الخصم بيتحسب على مجموع الفاتورة كلها.
          </DialogDescription>
        </DialogHeader>
        <DiscountForm
          {...formProps}
          valueInputRef={valueInputRef}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function DiscountForm({
  subtotal,
  current,
  onApply,
  onRemove,
  onClose,
  valueInputRef,
}: Omit<PosDiscountDialogProps, "open" | "onOpenChange"> & {
  onClose: () => void;
  valueInputRef: RefObject<HTMLInputElement | null>;
}) {
  const [mode, setMode] = useState<Mode>(
    current?.type === "percent" ? "percent" : "amount",
  );
  const [text, setText] = useState(current ? String(current.value) : "");

  const value = Number(normalizeDigits(text)) || 0;
  let discountAmount = 0;
  let error: string | null = null;

  if (mode === "percent") {
    if (value > 100) error = "النسبة لازم تكون بين 1 و100.";
    discountAmount = round2((subtotal * Math.min(value, 100)) / 100);
  } else if (mode === "amount") {
    if (value > subtotal)
      error = `الخصم أكبر من مجموع الفاتورة (${formatMoneyText(subtotal)}).`;
    discountAmount = round2(Math.min(value, subtotal));
  } else {
    if (value > subtotal)
      error = `الإجمالي النهائي أكبر من مجموع الفاتورة (${formatMoneyText(subtotal)}).`;
    discountAmount = round2(Math.max(subtotal - value, 0));
  }

  const valid = value > 0 && !error && discountAmount > 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    onApply(
      mode === "percent"
        ? { type: "percent", value }
        : { type: "amount", value: discountAmount },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div
        role="group"
        aria-label="نوع الخصم"
        className="grid grid-cols-3 gap-2"
      >
        {MODES.map((m) => (
          <Button
            key={m.id}
            type="button"
            size="lg"
            variant={mode === m.id ? "default" : "outline"}
            aria-pressed={mode === m.id}
            onClick={() => {
              setMode(m.id);
              setText("");
            }}
            className="px-1 font-normal"
          >
            {m.label}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        <Input
          ref={valueInputRef}
          dir="ltr"
          inputMode="decimal"
          autoComplete="off"
          aria-label="قيمة الخصم"
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-invalid={error ? true : undefined}
          className="h-12 text-center font-mono text-xl tabular-nums md:text-xl"
        />
        {mode === "percent" && (
          <div className="flex gap-1.5">
            {[5, 10, 15, 20].map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setText(String(p))}
                className="font-mono font-normal tabular-nums"
              >
                {p}%
              </Button>
            ))}
          </div>
        )}
      </div>

      <dl aria-live="polite" className="space-y-1 text-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <dt>المجموع</dt>
          <dd>
            <Money amount={subtotal} />
          </dd>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <dt>الخصم</dt>
          <dd>
            <Money amount={discountAmount} />
          </dd>
        </div>
        <div className="flex items-end justify-between">
          <dt className="pb-0.5 text-sm font-medium">بعد الخصم</dt>
          <dd>
            <Money
              amount={round2(subtotal - discountAmount)}
              className="text-2xl leading-none"
            />
          </dd>
        </div>
      </dl>

      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 text-xs text-destructive"
        >
          <IconAlertTriangle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {current && (
          <Button
            type="button"
            variant="destructive"
            size="lg"
            onClick={onRemove}
            className="sm:me-auto"
          >
            إزالة الخصم
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onClose}
          className="gap-2 font-normal"
        >
          رجوع
          <ShortcutBadge className="rounded-none">Esc</ShortcutBadge>
        </Button>
        <Button type="submit" size="lg" disabled={!valid} className="gap-2">
          تطبيق الخصم
          <ShortcutBadge className="rounded-none border-primary-foreground/30 text-primary-foreground/80">
            Enter
          </ShortcutBadge>
        </Button>
      </div>
    </form>
  );
}
