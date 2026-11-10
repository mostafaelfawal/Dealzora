"use client";

import { IconLoader2, IconPlayerPlay } from "@tabler/icons-react";
import { useState } from "react";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { moneyInputOrZero, parseNumberInput } from "@/lib/format";

import { useOpenShift } from "../hooks/useShifts";
import { CurrencyLabel } from "@/components/shared/CurrencyLabel";

const QUICK_FLOATS = [0, 200, 500, 1000];

/** فتح وردية: فكّة البداية فقط ثم Enter. يُستخدم في نافذة الـ Header وفي شاشة الكاشير. */
export function OpenShiftForm({
  onDone,
  onCancel,
}: {
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const open = useOpenShift();
  const [text, setText] = useState("");
  const value = parseNumberInput(text);
  const invalid = text.trim() !== "" && (!Number.isFinite(value) || value < 0);

  function submit() {
    if (invalid || open.isPending) return;
    open.mutate(moneyInputOrZero(text), { onSuccess: () => onDone?.() });
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
      <div className="space-y-1.5">
        <Label htmlFor="shift-float">فكّة الدرج في بداية الوردية (<CurrencyLabel />)</Label>
        <Input
          id="shift-float"
          autoFocus
          dir="ltr"
          inputMode="decimal"
          autoComplete="off"
          maxLength={10}
          placeholder="0"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={invalid}
          className="h-12 text-center font-mono text-xl"
        />
        {invalid && (
          <p role="alert" className="text-xs text-destructive">
            اكتب مبلغاً صحيحاً
          </p>
        )}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {QUICK_FLOATS.map((amount) => (
            <Button
              key={amount}
              type="button"
              size="sm"
              variant={
                moneyInputOrZero(text) === amount ? "default" : "outline"
              }
              onClick={() => setText(String(amount))}
              className="font-mono font-normal"
            >
              {amount}
            </Button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          المبلغ الموجود في الدرج قبل أول بيعة. يُحسب منه رصيد الدرج المتوقع عند
          القفل.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onCancel}
            className="gap-2 font-normal"
          >
            إلغاء
            <ShortcutBadge className="hidden rounded-none lg:inline-flex">
              Esc
            </ShortcutBadge>
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={invalid || open.isPending}
          className="gap-2 px-5"
        >
          {open.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconPlayerPlay className="size-4" />
          )}
          فتح الوردية
          <ShortcutBadge className="hidden rounded-none border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
            Enter
          </ShortcutBadge>
        </Button>
      </div>
    </form>
  );
}
