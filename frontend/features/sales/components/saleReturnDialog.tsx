"use client";

import { IconLoader2, IconMinus, IconPlus, IconReceiptRefund } from "@tabler/icons-react";
import { useState } from "react";

import { Money } from "@/components/shared/Money";
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
import { round2 } from "@/features/pos/lib/posCalc";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import { RETURN_REASONS } from "../config/saleOptions";
import { useCreateReturn } from "../hooks/useSales";
import type { ReturnReason, Sale } from "../types/sale";

const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

/** مرتجع من لوحة المدير (بدون مهلة). القيمة النهائية يحسبها السيرفر بالسعر المدفوع فعلاً. */
export function SaleReturnDialog({
  sale,
  onClose,
}: {
  sale: Sale | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={sale !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] gap-3 overflow-y-auto sm:max-w-lg"
      >
        {sale && <ReturnForm key={sale.id} sale={sale} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function ReturnForm({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const create = useCreateReturn();
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason>("customer_changed");
  const [note, setNote] = useState("");

  const chosen = sale.lines.filter((l) => (qtys[l.id] ?? 0) > 0);
  const estimate = round2(
    chosen.reduce((sum, l) => sum + (l.netTotal / l.qty) * qtys[l.id], 0),
  );

  function setQty(id: string, value: number, max: number) {
    setQtys((prev) => ({ ...prev, [id]: Math.min(Math.max(round3(value), 0), max) }));
  }

  function submit() {
    if (chosen.length === 0 || create.isPending) return;
    create.mutate(
      {
        saleId: sale.id,
        input: {
          reason,
          note: note.trim(),
          lines: chosen.map((l) => ({ saleLineId: l.id, qty: qtys[l.id] })),
        },
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
        <DialogTitle>مرتجع من فاتورة #{sale.number}</DialogTitle>
        <DialogDescription>
          {sale.customerName ?? "عميل نقدي"} · الأصناف ترجع للمخزون، والمبلغ
          يُخصم من دين العميل أولاً (لو الفاتورة آجلة) ثم يُرد نقداً من الخزنة.
        </DialogDescription>
      </DialogHeader>

      <ul className="divide-y border">
        {sale.lines.map((line) => {
          const max = round3(line.qty - line.returnedQty);
          const qty = qtys[line.id] ?? 0;
          return (
            <li
              key={line.id}
              className={cn("flex items-center gap-3 p-2.5", max === 0 && "opacity-50")}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{line.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  مباع {formatQty(line.qty)} {line.unitName}
                  {line.returnedQty > 0 && ` · رجع ${formatQty(line.returnedQty)}`}
                </span>
              </span>
              <div className="flex items-center">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label={`تقليل ${line.name}`}
                  disabled={qty <= 0}
                  onClick={() => setQty(line.id, qty - 1, max)}
                  className="size-8"
                >
                  <IconMinus />
                </Button>
                <Input
                  aria-label={`كمية مرتجع ${line.name}`}
                  dir="ltr"
                  inputMode="decimal"
                  disabled={max === 0}
                  value={qty === 0 ? "" : String(qty)}
                  placeholder="0"
                  onChange={(e) => setQty(line.id, Number(e.target.value) || 0, max)}
                  className="h-8 w-14 border-x-0 text-center font-mono"
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label={`زيادة ${line.name}`}
                  disabled={qty >= max}
                  onClick={() => setQty(line.id, qty + 1, max)}
                  className="size-8"
                >
                  <IconPlus />
                </Button>
              </div>
              <Button
                type="button"
                size="xs"
                variant="link"
                disabled={max === 0 || qty === max}
                onClick={() => setQty(line.id, max, max)}
                className="font-normal"
              >
                الكل
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">سبب المرتجع</span>
        <SegmentedTabs
          label="سبب المرتجع"
          items={RETURN_REASONS}
          value={reason}
          onChange={setReason}
        />
      </div>
      <Input
        aria-label="ملاحظة"
        value={note}
        maxLength={200}
        onChange={(e) => setNote(e.target.value)}
        placeholder="ملاحظة (اختياري)"
      />

      <div className="flex items-end justify-between border-t pt-3">
        <span className="pb-0.5 text-sm font-medium">قيمة المرتجع (تقريباً)</span>
        <Money amount={estimate} className="text-2xl leading-none" />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="lg" onClick={onClose} className="gap-2 font-normal">
          رجوع
          <ShortcutBadge className="hidden rounded-none lg:inline-flex">Esc</ShortcutBadge>
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={chosen.length === 0 || create.isPending}
          className="gap-2 px-5"
        >
          {create.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconReceiptRefund className="size-4" />
          )}
          تسجيل المرتجع
        </Button>
      </div>
    </form>
  );
}
