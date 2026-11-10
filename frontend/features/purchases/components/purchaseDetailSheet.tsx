"use client";

import { IconLoader2, IconReceiptRefund } from "@tabler/icons-react";
import { useState } from "react";

import { Money } from "@/components/shared/Money";
import { listItem, MotionLi } from "@/components/shared/motion";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { round2 } from "@/features/pos/lib/posCalc";
import { formatDate, parseIsoDay } from "@/lib/dates";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useCreatePurchaseReturn, usePurchase } from "../hooks/usePurchases";
import type { Purchase, RefundMethod } from "../types/purchase";

const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export function PurchaseDetailSheet({
  purchaseId,
  onClose,
}: {
  purchaseId: string | null;
  onClose: () => void;
}) {
  const query = usePurchase(purchaseId);
  const [returning, setReturning] = useState(false);
  const p = query.data;

  return (
    <Sheet
      open={purchaseId !== null}
      onOpenChange={(next) => !next && onClose()}
    >
      <SheetContent
        side="left"
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="text-base">
            فاتورة شراء #{p?.number ?? "…"}
          </SheetTitle>
          <SheetDescription>
            {p
              ? `${p.supplierName} · ${formatDate(parseIsoDay(p.purchasedOn))}${p.supplierInvoice ? ` · فاتورة المورد ${p.supplierInvoice}` : ""}`
              : "جارٍ التحميل…"}
          </SheetDescription>
        </SheetHeader>
        {!p ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 p-4">
            <ul className="divide-y border">
              {p.lines.map((l, i) => (
                <MotionLi
                  key={l.id}
                  {...listItem(i)}
                  className="flex items-start gap-3 p-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {l.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatQty(l.qty)} {l.unitName} × {l.unitCost}
                      {l.returnedQty > 0 &&
                        ` · رجع ${formatQty(l.returnedQty)}`}
                    </span>
                  </span>
                  <Money amount={l.lineTotal} className="text-sm" />
                </MotionLi>
              ))}
            </ul>
            <dl className="space-y-1.5 text-xs">
              {p.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">خصم المورد</dt>
                  <dd>
                    <Money amount={p.discount} />
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-sm font-medium">الإجمالي</dt>
                <dd>
                  <Money amount={p.total} className="text-xl" />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">مدفوع من الخزنة</dt>
                <dd>
                  <Money amount={p.paidAmount} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">آجل على الحساب</dt>
                <dd>
                  <Money
                    amount={p.creditAmount}
                    className={p.creditAmount > 0 ? "text-warning" : ""}
                  />
                </dd>
              </div>
              {p.returnedTotal > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">مرتجع للمورد</dt>
                  <dd>
                    <Money
                      amount={p.returnedTotal}
                      className="text-destructive"
                    />
                  </dd>
                </div>
              )}
              {p.note && (
                <p className="pt-1 text-muted-foreground">ملاحظة: {p.note}</p>
              )}
            </dl>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setReturning(true)}
              className="mt-auto gap-2"
            >
              <IconReceiptRefund className="size-4" />
              مرتجع للمورد
            </Button>
          </div>
        )}
      </SheetContent>
      <PurchaseReturnDialog
        purchase={returning ? (p ?? null) : null}
        onClose={() => setReturning(false)}
      />
    </Sheet>
  );
}

function PurchaseReturnDialog({
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
        {purchase && (
          <ReturnForm key={purchase.id} purchase={purchase} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
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
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<RefundMethod>("balance");
  const [note, setNote] = useState("");

  const chosen = purchase.lines
    .map((l) => ({ line: l, qty: round3(Number(qtys[l.id]) || 0) }))
    .filter((x) => x.qty > 0);
  const invalid = chosen.some((x) => x.qty > x.line.qty - x.line.returnedQty);
  const estimate = round2(
    chosen.reduce((s, x) => s + (x.line.lineTotal / x.line.qty) * x.qty, 0) *
      (purchase.subtotal > 0 ? purchase.total / purchase.subtotal : 1),
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!chosen.length || invalid) return;
        create.mutate(
          {
            purchaseId: purchase.id,
            refundMethod: method,
            note,
            lines: chosen.map((x) => ({ lineId: x.line.id, qty: x.qty })),
          },
          { onSuccess: onClose },
        );
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
        {purchase.lines.map((l) => {
          const max = round3(l.qty - l.returnedQty);
          const over = (Number(qtys[l.id]) || 0) > max;
          return (
            <li
              key={l.id}
              className={cn(
                "flex items-center gap-3 p-2.5",
                max === 0 && "opacity-50",
              )}
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
                value={qtys[l.id] ?? ""}
                placeholder="0"
                onChange={(e) =>
                  setQtys((prev) => ({ ...prev, [l.id]: e.target.value }))
                }
                dir="ltr"
                inputMode="decimal"
                className="h-8 w-20 text-center font-mono"
              />
            </li>
          );
        })}
      </ul>
      <SegmentedTabs
        label="طريقة رد المبلغ"
        items={[
          { id: "balance", label: "خصم من مستحقات المورد" },
          { id: "cash", label: "استلمت نقداً" },
        ]}
        value={method}
        onChange={setMethod}
      />
      <Input
        value={note}
        maxLength={200}
        onChange={(e) => setNote(e.target.value)}
        placeholder="ملاحظة (اختياري)"
        aria-label="ملاحظة"
      />
      <div className="flex items-end justify-between border-t pt-3">
        <span className="text-sm font-medium">قيمة المرتجع (تقريباً)</span>
        <Money amount={estimate} className="text-2xl leading-none" />
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
          disabled={!chosen.length || invalid || create.isPending}
          className="gap-2"
        >
          {create.isPending && <IconLoader2 className="size-4 animate-spin" />}
          تسجيل المرتجع
        </Button>
      </div>
    </form>
  );
}
