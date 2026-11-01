"use client";

import { IconMinus, IconPlus } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatQty, normalizeDigits } from "../lib/posCalc";
import type { CartLine } from "../types/pos";

interface PosQtyFieldProps {
  line: CartLine;
  onCommit: (qty: number) => void;
  onStep: (direction: 1 | -1) => void;
  /** يرجّع الفوكس لخانة الباركود بعد التعديل. */
  onDone: () => void;
}

/** كمية الصنف: − رقم قابل للتعديل +. للمس والماوس، والكيبورد بيستخدم + و - من خانة الباركود. */
export function PosQtyField({
  line,
  onCommit,
  onStep,
  onDone,
}: PosQtyFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const value = Number(normalizeDigits(draft));
    if (Number.isFinite(value) && value > 0) onCommit(value);
    setDraft(null);
  }

  return (
    <div className="flex items-center gap-1" dir="ltr">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`تقليل كمية ${line.name}`}
        onClick={() => onStep(-1)}
        className="size-9 lg:size-7"
      >
        <IconMinus />
      </Button>
      <Input
        inputMode="decimal"
        aria-label={`كمية ${line.name}`}
        value={draft ?? formatQty(line.qty)}
        onFocus={(event) => {
          setDraft(String(line.qty));
          event.currentTarget.select();
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
            onDone();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setDraft(null);
            onDone();
          }
        }}
        className="h-9 w-14 px-1 text-center font-mono tabular-nums lg:h-7"
      />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`زيادة كمية ${line.name}`}
        onClick={() => onStep(1)}
        className="size-9 lg:size-7"
      >
        <IconPlus />
      </Button>
    </div>
  );
}
