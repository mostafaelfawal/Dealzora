"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";

import { Money } from "@/components/shared/Money";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import { PURCHASE_LIMITS, REFUND_METHODS } from "../config/purchaseOptions";
import { useCreatePurchaseReturn } from "../hooks/usePurchases";
import {
  parseQty,
  returnableQty,
  returnSelection,
  type ReturnQtys,
} from "../lib/purchaseReturn";
import type { Purchase, PurchaseLine, RefundMethod } from "../types/purchase";

function ReturnLineRow({
  line: l,
  value,
  onChange,
}: {
  line: PurchaseLine;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  const max = returnableQty(l);
  const over = parseQty(value) > max;

  return (
    <li
      className={cn("flex items-center gap-3 p-2.5", max === 0 && "opacity-50")}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{l.name}</span>
        <span
          className={cn(
            "text-[11px]",
            over ? "text-destructive" : "text-muted-foreground",
          )}
        >
          المتاح للإرجاع {formatQty(max)} {l.unitName}
        </span>
      </span>
      <Input
        aria-label={`كمية مرتجع ${l.name}`}
        disabled={max === 0}
        value={value ?? ""}
        placeholder="0"
        onChange={(e) => onChange(e.target.value)}
        dir="ltr"
        inputMode="decimal"
        className="h-8 w-20 text-center font-mono"
      />
    </li>
  );
}

function ReturnForm({
  purchase,
  onClose,
}: {
  purchase: Purchase;
  onClose: () => void;
}) {
  const create = useCreatePurchaseReturn();
  const [qtys, setQtys] = useState<ReturnQtys>({});
  const [method, setMethod] = useState<RefundMethod>("balance");
  const [note, setNote] = useState("");
  const selection = returnSelection(purchase, qtys);

  function submit() {
    if (!selection.canSubmit) return;
    create.mutate(
      {
        purchaseId: purchase.id,
        refundMethod: method,
        note,
        lines: selection.lines,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-3"
    >
      <DialogHeader className="text-start">
        <DialogTitle>مرتجع للمورد من فاتورة #{purchase.number}</DialogTitle>
        <DialogDescription>
          الأصناف تخرج من المخزون. اختر هل يُخصم المبلغ من مستحقات المورد أم
          استلمته نقداً.
        </DialogDescription>
      </DialogHeader>

      <ul className="divide-y border">
        {purchase.lines.map((l) => (
          <ReturnLineRow
            key={l.id}
            line={l}
            value={qtys[l.id]}
            onChange={(v) => setQtys((prev) => ({ ...prev, [l.id]: v }))}
          />
        ))}
      </ul>

      <SegmentedTabs
        label="طريقة رد المبلغ"
        items={REFUND_METHODS}
        value={method}
        onChange={setMethod}
      />
      <Input
        value={note}
        maxLength={PURCHASE_LIMITS.note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="ملاحظة (اختياري)"
        aria-label="ملاحظة"
      />

      <div className="flex items-end justify-between border-t pt-3">
        <span className="text-sm font-medium">قيمة المرتجع (تقريباً)</span>
        <Money amount={selection.estimate} className="text-2xl leading-none" />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onClose}
          className="font-normal"
        >
          رجوع
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={!selection.canSubmit || create.isPending}
          className="gap-2"
        >
          {create.isPending && <IconLoader2 className="size-4 animate-spin" />}
          تسجيل المرتجع
        </Button>
      </div>
    </form>
  );
}

/** مرتجع جزئي أو كلي من فاتورة شراء. */
export function PurchaseReturnDialog({
  purchase,
  onClose,
}: {
  purchase: Purchase | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={purchase !== null}
      onOpenChange={(next) => !next && onClose()}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] gap-3 overflow-y-auto sm:max-w-lg"
      >
        {/* key يعيد تهيئة النموذج لكل فاتورة. */}
        {purchase && (
          <ReturnForm key={purchase.id} purchase={purchase} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
