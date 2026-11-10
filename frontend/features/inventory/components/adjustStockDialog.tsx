"use client";

import { IconAlertTriangle, IconDeviceFloppy, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";

import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
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
import { formatQty, parseNumberInput } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ADJUST_REASONS } from "../config/inventoryOptions";
import { useAdjustStock } from "../hooks/useInventory";
import type { AdjustReason } from "../types/inventory";

export interface AdjustTarget {
  productId: string;
  name: string;
  unit: string;
  stock: number;
}

const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

/** تعديل المخزون يدوياً مع سبب: جرد / تالف / هدية / أخرى. يُسجَّل في حركة الصنف وسجل العمليات. */
export function AdjustStockDialog({
  target,
  onClose,
}: {
  target: AdjustTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="gap-3 sm:max-w-md">
        {target && <AdjustForm key={target.productId} target={target} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function AdjustForm({ target, onClose }: { target: AdjustTarget; onClose: () => void }) {
  const adjust = useAdjustStock();
  const [reason, setReason] = useState<AdjustReason>("count");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const config = ADJUST_REASONS.find((r) => r.id === reason)!;

  const qty = parseNumberInput(text);
  const valid = Number.isFinite(qty);
  const after = !valid
    ? target.stock
    : reason === "count"
      ? qty
      : reason === "other"
        ? round3(target.stock + qty)
        : round3(target.stock - qty);

  let error: string | null = null;
  if (text.trim() && !valid) error = "اكتب رقماً صحيحاً";
  else if (valid && reason === "count" && qty < 0) error = "الرصيد لا يكون سالباً";
  else if (valid && (reason === "damage" || reason === "gift") && qty <= 0) error = "الكمية أكبر من صفر";
  else if (valid && reason === "other" && qty === 0) error = "الفرق لا يكون صفراً";
  else if (valid && after < 0) error = `الكمية أكبر من الرصيد المتاح (${formatQty(target.stock)})`;
  else if (reason === "other" && !note.trim()) error = "اكتب سبب التعديل";
  const canSave = text.trim() !== "" && !error && after !== target.stock;

  function submit() {
    if (!canSave || adjust.isPending) return;
    adjust.mutate({ productId: target.productId, input: { reason, qty, note } }, { onSuccess: onClose });
  }

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
      <DialogHeader className="text-start">
        <DialogTitle>تعديل مخزون «{target.name}»</DialogTitle>
        <DialogDescription>
          الرصيد الحالي {formatQty(target.stock)} {target.unit}. كل تعديل يُسجَّل بسببه في حركة الصنف.
        </DialogDescription>
      </DialogHeader>

      <SegmentedTabs
        label="سبب التعديل"
        items={ADJUST_REASONS.map((r) => ({ id: r.id, label: r.label }))}
        value={reason}
        onChange={(r) => {
          setReason(r);
          setText("");
        }}
      />

      <div className="space-y-1.5">
        <Label htmlFor="adj-qty">{config.qtyLabel} ({target.unit})</Label>
        <Input
          id="adj-qty"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          dir="ltr"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={Boolean(error && text)}
          placeholder={reason === "count" ? String(target.stock) : "0"}
          className="h-12 text-center font-mono text-xl"
        />
        <p className="text-[11px] text-muted-foreground">{config.hint}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="adj-note">ملاحظة {reason === "other" ? "*" : "(اختياري)"}</Label>
        <Input id="adj-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="مثال: كسر أثناء النقل" />
      </div>

      <div className="flex items-end justify-between border-t pt-3 text-xs">
        <span className="pb-0.5 text-sm font-medium">الرصيد بعد التعديل</span>
        <span className={cn("font-mono text-2xl leading-none tabular-nums", after < target.stock ? "text-destructive" : after > target.stock ? "text-success" : "")}>
          {formatQty(after)} <span className="text-xs text-muted-foreground">{target.unit}</span>
        </span>
      </div>

      {error && text.trim() !== "" && (
        <p role="alert" className="flex items-center gap-2 text-xs text-destructive">
          <IconAlertTriangle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="lg" onClick={onClose} className="gap-2 font-normal">
          رجوع
          <ShortcutBadge className="hidden rounded-none lg:inline-flex">Esc</ShortcutBadge>
        </Button>
        <Button type="submit" size="lg" disabled={!canSave || adjust.isPending} className="gap-2 px-5">
          {adjust.isPending ? <IconLoader2 className="size-4 animate-spin" /> : <IconDeviceFloppy className="size-4" />}
          حفظ التعديل
          <ShortcutBadge className="hidden rounded-none border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">Enter</ShortcutBadge>
        </Button>
      </div>
    </form>
  );
}
