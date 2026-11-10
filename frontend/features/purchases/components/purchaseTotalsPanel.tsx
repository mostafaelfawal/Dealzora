"use client";

import { IconDeviceFloppy, IconLoader2, IconPlus } from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  PURCHASE_FIELD_IDS as IDS,
  PURCHASE_FORM_SHORTCUTS,
} from "../config/purchaseOptions";
import type { PurchaseDraft } from "../hooks/usePurchaseDraft";

function AmountInput({
  id,
  label,
  value,
  onChange,
  muted,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label
        htmlFor={id}
        className={muted ? "font-normal text-muted-foreground" : "font-normal"}
      >
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        dir="ltr"
        inputMode="decimal"
        className={className}
      />
    </div>
  );
}

/** المجموع والخصم والمدفوع والمتبقي على المورد + أزرار الحفظ. */
export function PurchaseTotalsPanel({ draft }: { draft: PurchaseDraft }) {
  const { totals, errors, submitted, isSaving } = draft;

  return (
    <div className="space-y-2 border bg-card p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">
          المجموع ({draft.lines.length} صنف)
        </span>
        <Money amount={totals.subtotal} />
      </div>

      <AmountInput
        id={IDS.discount}
        label="خصم المورد"
        value={draft.discount}
        onChange={draft.setDiscount}
        muted
        className="h-8 w-32 font-mono"
      />

      <div className="flex items-end justify-between border-t pt-2">
        <span className="pb-0.5 text-sm font-medium">الإجمالي</span>
        <Money amount={totals.total} className="text-2xl leading-none" />
      </div>

      <AmountInput
        id={IDS.paid}
        label="المدفوع الآن من الخزنة"
        value={draft.paid}
        onChange={draft.setPaid}
        className="h-9 w-32 font-mono"
      />

      <div className="flex gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="font-normal"
          onClick={() => draft.setPaid(String(totals.total))}
        >
          دفع كامل
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="font-normal"
          onClick={() => draft.setPaid("")}
        >
          آجل بالكامل
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">يُضاف لحساب المورد</span>
        <Money
          amount={Math.max(totals.remaining, 0)}
          className={totals.remaining > 0 ? "text-warning" : ""}
        />
      </div>

      {submitted && errors.length > 0 && (
        <ul role="alert" className="space-y-0.5 text-destructive">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 pt-1">
        <Button
          size="lg"
          disabled={isSaving}
          onClick={() => draft.submit(false)}
          className="h-11 gap-2"
        >
          {isSaving ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconDeviceFloppy className="size-4" />
          )}
          حفظ الفاتورة
          <ShortcutBadge className="border-primary-foreground/30 text-primary-foreground/80">
            {PURCHASE_FORM_SHORTCUTS.save.label}
          </ShortcutBadge>
        </Button>
        <Button
          size="lg"
          variant="outline"
          disabled={isSaving}
          onClick={() => draft.submit(true)}
          className="gap-2 font-normal"
        >
          <IconPlus className="size-4" />
          حفظ وفاتورة جديدة
        </Button>
      </div>
    </div>
  );
}
