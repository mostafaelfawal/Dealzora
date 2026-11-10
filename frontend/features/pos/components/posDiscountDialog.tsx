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
import { formatMoneyText, normalizeDigits } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { round2 } from "../lib/posCalc";
import { applyDiscount } from "../store/posActions";
import { posUiActions } from "../store/posUiSlice";
import { lineDiscount, lineGross, lineKey } from "../lib/posCalc";
import {
  selectInvoiceDiscount,
  selectLines,
  selectSelectedId,
  selectTotals,
} from "../store/selectors";

type Mode = "amount" | "percent" | "final";

const MODES: { id: Mode; label: string }[] = [
  { id: "amount", label: "مبلغ" },
  { id: "percent", label: "نسبة %" },
  { id: "final", label: "الإجمالي النهائي" },
];

export function PosDiscountDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.posUi.dialog === "discount");
  const isLine = useAppSelector((s) => s.posUi.discountTarget === "line");
  const lineName = useAppSelector((s) => {
    const id = selectSelectedId(s);
    return selectLines(s).find((l) => lineKey(l) === id)?.name ?? "";
  });
  const valueInputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && dispatch(posUiActions.closeDialog())}
    >
      <DialogContent
        showCloseButton={false}
        initialFocus={valueInputRef}
        className="gap-3 sm:max-w-sm"
      >
        <DialogHeader className="text-start">
          <DialogTitle>
            {isLine ? `خصم على «${lineName}»` : "خصم على الفاتورة"}
          </DialogTitle>
          <DialogDescription>
            {isLine
              ? "يُخصم من قيمة هذا الصنف فقط. للخصم على الفاتورة كلها اضغط F8."
              : "يُحتسب الخصم على مجموع الفاتورة بأكملها. للخصم على صنف واحد اضغط F5."}
          </DialogDescription>
        </DialogHeader>
        <DiscountForm
          key={isLine ? "line" : "invoice"}
          valueInputRef={valueInputRef}
        />
      </DialogContent>
    </Dialog>
  );
}

function DiscountForm({
  valueInputRef,
}: {
  valueInputRef: RefObject<HTMLInputElement | null>;
}) {
  const dispatch = useAppDispatch();
  const isLine = useAppSelector((s) => s.posUi.discountTarget === "line");
  const totals = useAppSelector(selectTotals);
  const invoiceDiscount = useAppSelector(selectInvoiceDiscount);
  const selectedLine = useAppSelector((s) => {
    const id = selectSelectedId(s);
    return selectLines(s).find((l) => lineKey(l) === id) ?? null;
  });
  // في خصم الصنف: الأساس قيمة السطر، والخصم الحالي مبلغ ثابت.
  const subtotal =
    isLine && selectedLine ? lineGross(selectedLine) : totals.subtotal;
  const lineCurrent =
    selectedLine && lineDiscount(selectedLine) > 0
      ? { type: "amount" as const, value: lineDiscount(selectedLine) }
      : null;
  const current = isLine ? lineCurrent : invoiceDiscount;

  // حالة الفورم نفسها (النوع والنص المكتوب) محلية، فمفيش سبب تروح الـ store.
  const [mode, setMode] = useState<Mode>(
    current?.type === "percent" ? "percent" : "amount",
  );
  const [text, setText] = useState(current ? String(current.value) : "");

  const value = Number(normalizeDigits(text)) || 0;
  let discountAmount = 0;
  let error: string | null = null;

  if (mode === "percent") {
    if (value > 100) error = "يجب أن تكون النسبة بين 1 و100.";
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
    dispatch(
      applyDiscount(
        mode === "percent" && !isLine
          ? { type: "percent", value }
          : { type: "amount", value: discountAmount },
      ),
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
            onClick={() => dispatch(applyDiscount(null))}
            className="sm:me-auto"
          >
            إزالة الخصم
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => dispatch(posUiActions.closeDialog())}
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
