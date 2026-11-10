"use client";

import { IconLoader2, IconLockDollar } from "@tabler/icons-react";
import { useState } from "react";

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
import { formatTime, moneyInputOrZero, parseNumberInput } from "@/lib/format";

import { CASH_DENOMINATIONS } from "../config/shiftQueryKeys";
import { useCloseShift } from "../hooks/useShifts";
import type { Shift } from "../types/shift";
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

function CloseShiftForm({
  shift,
  onCancel,
  onDone,
}: {
  shift: Shift;
  onCancel: () => void;
  onDone: () => void;
}) {
  const close = useCloseShift();
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");

  const countOf = (d: number) => {
    const n = parseNumberInput(counts[d] ?? "");
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };
  const counted =
    Math.round(
      (CASH_DENOMINATIONS.reduce((sum, d) => sum + d * countOf(d), 0) +
        moneyInputOrZero(other)) *
        100,
    ) / 100;
  const expected = shift.expectedCash;
  const diff = expected === null ? null : Math.round((counted - expected) * 100) / 100;

  function submit() {
    if (close.isPending) return;
    close.mutate({ counted, note }, { onSuccess: onDone });
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      <DialogHeader className="text-start">
        <DialogTitle>قفل الوردية وجرد الدرج</DialogTitle>
        <DialogDescription>
          {shift.cashierName ?? "الكاشير"} · فُتحت {formatTime(shift.openedAt)} ·{" "}
          {shift.salesCount} فاتورة. عدّ النقدية في الدرج واكتب عدد كل فئة.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CASH_DENOMINATIONS.map((d, i) => (
          <label key={d} className="flex items-center gap-2 border p-1.5 ps-2.5">
            <span className="w-10 shrink-0 font-mono text-sm font-semibold tabular-nums">
              {d}
            </span>
            <span aria-hidden className="text-xs text-muted-foreground">
              ×
            </span>
            <Input
              autoFocus={i === 0}
              aria-label={`عدد فئة ${d} جنيه`}
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              maxLength={5}
              placeholder="0"
              value={counts[d] ?? ""}
              onChange={(e) => setCounts((prev) => ({ ...prev, [d]: e.target.value }))}
              onFocus={(e) => e.currentTarget.select()}
              className="h-8 min-w-0 text-center font-mono"
            />
          </label>
        ))}
        <label className="col-span-2 flex items-center gap-2 border p-1.5 ps-2.5 sm:col-span-2">
          <span className="shrink-0 text-xs text-muted-foreground">فكّة / أخرى</span>
          <Input
            aria-label="مبالغ أخرى بالجنيه"
            dir="ltr"
            inputMode="decimal"
            autoComplete="off"
            maxLength={10}
            placeholder="0"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            className="h-8 min-w-0 text-center font-mono"
          />
        </label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="shift-note">ملاحظة (اختياري)</Label>
        <Input
          id="shift-note"
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          placeholder="مثال: سُحب 500 للبنك"
        />
      </div>

      <Separator />

      <dl aria-live="polite" className="space-y-1.5 text-xs">
        <div className="flex items-end justify-between">
          <dt className="pb-0.5 text-sm font-medium">النقدية الفعلية في الدرج</dt>
          <dd>
            <Money amount={counted} className="text-3xl leading-none" />
          </dd>
        </div>
        {expected !== null && diff !== null && (
          <>
            <div className="flex items-center justify-between text-muted-foreground">
              <dt>المتوقع حسب النظام</dt>
              <dd>
                <Money amount={expected} />
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">الفرق</dt>
              <dd
                className={
                  diff === 0 ? "text-success" : diff > 0 ? "text-warning" : "text-destructive"
                }
              >
                {diff === 0 ? (
                  "مطابق"
                ) : (
                  <span className="inline-flex items-baseline gap-1">
                    {diff > 0 ? "زيادة" : "عجز"}
                    <Money amount={Math.abs(diff)} />
                  </span>
                )}
              </dd>
            </div>
          </>
        )}
      </dl>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onCancel}
          disabled={close.isPending}
          className="gap-2 font-normal"
        >
          رجوع
          <ShortcutBadge className="hidden rounded-none lg:inline-flex">Esc</ShortcutBadge>
        </Button>
        <Button type="submit" size="lg" disabled={close.isPending} className="gap-2 px-5">
          {close.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconLockDollar className="size-4" />
          )}
          قفل الوردية
          <ShortcutBadge className="hidden rounded-none border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
            Enter
          </ShortcutBadge>
        </Button>
      </div>
    </form>
  );
}
