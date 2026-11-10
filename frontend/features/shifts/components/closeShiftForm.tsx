"use client";

import { IconLoader2, IconLockDollar } from "@tabler/icons-react";
import { useState } from "react";

import { Money } from "@/components/shared/Money";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatTime } from "@/lib/format";

import { CASH_DENOMINATIONS, SHIFT_LIMITS } from "../config/shiftOptions";
import { useCloseShift } from "../hooks/useShifts";
import {
  cashDifference,
  countedCash,
  type DenominationCounts,
} from "../lib/shiftCount";
import type { Shift } from "../types/shift";

const NOTE_ID = "shift-note";

/** شبكة عدّ الفئات + خانة "فكّة / أخرى". */
function CashCountGrid({
  counts,
  onCountChange,
  other,
  onOtherChange,
}: {
  counts: DenominationCounts;
  onCountChange: (denomination: number, value: string) => void;
  other: string;
  onOtherChange: (value: string) => void;
}) {
  return (
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
            maxLength={SHIFT_LIMITS.denominationCount}
            placeholder="0"
            value={counts[d] ?? ""}
            onChange={(e) => onCountChange(d, e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="h-8 min-w-0 text-center font-mono"
          />
        </label>
      ))}
      <label className="col-span-2 flex items-center gap-2 border p-1.5 ps-2.5 sm:col-span-2">
        <span className="shrink-0 text-xs text-muted-foreground">
          فكّة / أخرى
        </span>
        <Input
          aria-label="مبالغ أخرى بالجنيه"
          dir="ltr"
          inputMode="decimal"
          autoComplete="off"
          maxLength={SHIFT_LIMITS.otherAmount}
          placeholder="0"
          value={other}
          onChange={(e) => onOtherChange(e.target.value)}
          className="h-8 min-w-0 text-center font-mono"
        />
      </label>
    </div>
  );
}

const diffClass = (diff: number) =>
  diff === 0 ? "text-success" : diff > 0 ? "text-warning" : "text-destructive";

/** المعدود + (للمدير فقط) المتوقع والفرق. */
function CountSummary({
  counted,
  expected,
}: {
  counted: number;
  expected: number | null;
}) {
  const diff = cashDifference(counted, expected);
  return (
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
            <dd className={diffClass(diff)}>
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
  );
}

/** نموذج قفل الوردية: عدّ الفئات ← ملاحظة ← قفل. */
export function CloseShiftForm({
  shift,
  onCancel,
  onDone,
}: {
  shift: Shift;
  onCancel: () => void;
  onDone: () => void;
}) {
  const close = useCloseShift();
  const [counts, setCounts] = useState<DenominationCounts>({});
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  const counted = countedCash(counts, other);

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
          {shift.cashierName ?? "الكاشير"} · فُتحت {formatTime(shift.openedAt)}{" "}
          · {shift.salesCount} فاتورة. عدّ النقدية في الدرج واكتب عدد كل فئة.
        </DialogDescription>
      </DialogHeader>

      <CashCountGrid
        counts={counts}
        onCountChange={(d, v) => setCounts((prev) => ({ ...prev, [d]: v }))}
        other={other}
        onOtherChange={setOther}
      />

      <div className="space-y-1.5">
        <Label htmlFor={NOTE_ID}>ملاحظة (اختياري)</Label>
        <Input
          id={NOTE_ID}
          value={note}
          maxLength={SHIFT_LIMITS.note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="مثال: سُحب 500 للبنك"
        />
      </div>

      <Separator />

      <CountSummary counted={counted} expected={shift.expectedCash} />

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
          <ShortcutBadge className="hidden rounded-none lg:inline-flex">
            Esc
          </ShortcutBadge>
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={close.isPending}
          className="gap-2 px-5"
        >
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
