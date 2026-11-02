"use client";

import { IconMinus, IconPlus } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatQty, normalizeDigits } from "@/lib/format";
import { useAppDispatch } from "@/lib/store/hooks";
import { focusSearch } from "../lib/posFocus";
import { cartActions } from "../store/cartSlice";
import type { CartLine } from "../types/pos";
import { AppTooltip } from "@/components/shared/AppTooltip";

/** كمية الصنف: − رقم قابل للتعديل +. للمس والفأرة، ولوحة المفاتيح تستخدم + و - من خانة الباركود. */
export function PosQtyField({ line }: { line: CartLine }) {
  const dispatch = useAppDispatch();
  const [draft, setDraft] = useState<string | null>(null);
  const id = line.productId;

  function commit() {
    if (draft === null) return;
    const value = Number(normalizeDigits(draft));
    if (Number.isFinite(value) && value > 0) {
      dispatch(cartActions.setQty({ id, qty: value }));
    }
    setDraft(null);
  }

  return (
    <div className="flex items-center gap-1" dir="ltr">
      <AppTooltip message={`تقليل كمية ${line.name}`}>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`تقليل كمية ${line.name}`}
          onClick={() => dispatch(cartActions.changeQty({ id, direction: -1 }))}
          className="size-9 lg:size-7"
        >
          <IconMinus />
        </Button>
      </AppTooltip>
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
            focusSearch();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setDraft(null);
            focusSearch();
          }
        }}
        className="h-9 w-14 px-1 text-center font-mono tabular-nums lg:h-7"
      />
      <AppTooltip message={`زيادة كمية ${line.name}`}>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`زيادة كمية ${line.name}`}
          onClick={() => dispatch(cartActions.changeQty({ id, direction: 1 }))}
          className="size-9 lg:size-7"
        >
          <IconPlus />
        </Button>
      </AppTooltip>
    </div>
  );
}
