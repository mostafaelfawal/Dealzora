"use client";

import { IconAlertTriangle, IconMinus, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useNow } from "@/hooks/useNow";
import { useSessionUser } from "@/hooks/useShellData";
import { formatQty } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { cn } from "cn";
import { RETURN_REASONS, RETURN_WINDOW_DAYS } from "../config/posReturn";
import { isReturnExpired, returnableQty, returnValue } from "../lib/returnCalc";
import { requestReturn, startExchange } from "../store/posActions";
import { posUiActions } from "../store/posUiSlice";
import { selectIsEmpty, selectPendingInvoice } from "../store/selectors";
import type {
  CompletedInvoice,
  ExchangeDraft,
  ReturnLine,
  ReturnReason,
} from "../types/pos";

/** الخطوة 2: تحديد الأصناف والكميات المرتجعة والسبب. */
export function PosReturnDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.posUi.dialog === "return");
  const invoice = useAppSelector(selectPendingInvoice);

  return (
    <Dialog
      open={open && invoice !== null}
      onOpenChange={(next) => !next && dispatch(posUiActions.closeDialog())}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] gap-3 overflow-y-auto sm:max-w-lg"
      >
        {invoice && <ReturnForm key={invoice.id} invoice={invoice} />}
      </DialogContent>
    </Dialog>
  );
}

function ReturnForm({ invoice }: { invoice: CompletedInvoice }) {
  const dispatch = useAppDispatch();
  const cartEmpty = useAppSelector(selectIsEmpty);
  const now = useNow(30_000);

  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason | null>(null);

  // المدير يرجّع بدون مهلة (الـ backend يطبّق نفس القاعدة).
  const isManager = useSessionUser().role === "manager";
  const expired = !isManager && now !== null && isReturnExpired(invoice.soldAt, now);

  const lines: ReturnLine[] = invoice.lines
    .filter((l) => (qtys[l.productId] ?? 0) > 0)
    .map((l) => ({
      lineId: l.lineId,
      productId: l.productId,
      name: l.name,
      unit: l.unit,
      price: l.price,
      qty: qtys[l.productId],
      allowDecimal: l.allowDecimal,
    }));

  const total = returnValue(lines, invoice.discountRate);
  const valid = lines.length > 0 && reason !== null && !expired;

  function setQty(id: string, next: number, max: number) {
    const clamped = Math.min(Math.max(next, 0), max);
    setQtys((prev) => ({ ...prev, [id]: clamped }));
  }

  function submit(mode: "exchange" | "returnOnly") {
    if (!valid || reason === null) return;
    const draft: ExchangeDraft = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      discountRate: invoice.discountRate,
      reason,
      lines,
    };
    dispatch(startExchange(draft, mode));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit("exchange");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <DialogHeader className="text-start">
        <DialogTitle>مرتجع من فاتورة #{invoice.number}</DialogTitle>
        <DialogDescription>
          {invoice.customer?.name ?? "عميل نقدي"} · حدّد الكمية المرتجعة من كل
          صنف. يُحتسب المرتجع بسعر البيع الأصلي.
        </DialogDescription>
      </DialogHeader>

      {expired && (
        <p
          role="alert"
          className="flex items-center gap-2 text-xs text-destructive"
        >
          <IconAlertTriangle className="size-4 shrink-0" />
          مرّت أكثر من {RETURN_WINDOW_DAYS} يوماً على البيع. يلزم موافقة المشرف.
        </p>
      )}

      <ul className="divide-y border">
        {invoice.lines.map((line) => {
          const max = returnableQty(line);
          const qty = qtys[line.productId] ?? 0;
          const step = line.allowDecimal ? 0.5 : 1;
          return (
            <li
              key={line.productId}
              className={cn(
                "flex items-center gap-3 p-2.5",
                max === 0 && "opacity-60",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {line.name}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Money amount={line.price} className="text-[11px]" />
                  <span>/ {line.unit}</span>
                  <span aria-hidden>·</span>
                  {max === 0 ? (
                    <span>تم إرجاعه بالكامل</span>
                  ) : (
                    <span>المتاح للإرجاع {formatQty(max)}</span>
                  )}
                </span>
              </span>

              <div className="flex items-center gap-1" dir="ltr">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={max === 0 || qty <= 0}
                  aria-label={`تقليل مرتجع ${line.name}`}
                  onClick={() => setQty(line.productId, qty - step, max)}
                  className="size-9"
                >
                  <IconMinus />
                </Button>
                <span className="w-10 text-center font-mono text-sm tabular-nums">
                  {formatQty(qty)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={max === 0 || qty >= max}
                  aria-label={`زيادة مرتجع ${line.name}`}
                  onClick={() => setQty(line.productId, qty + step, max)}
                  className="size-9"
                >
                  <IconPlus />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={max === 0 || qty === max}
                  onClick={() => setQty(line.productId, max, max)}
                  className="font-normal"
                >
                  الكل
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">سبب الإرجاع (إلزامي)</p>
        <div
          role="group"
          aria-label="سبب الإرجاع"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {RETURN_REASONS.map((r) => (
            <Button
              key={r.id}
              type="button"
              size="lg"
              variant={reason === r.id ? "default" : "outline"}
              aria-pressed={reason === r.id}
              onClick={() => setReason(r.id)}
              className="px-1 font-normal"
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="flex items-end justify-between">
        <span className="pb-0.5 text-sm font-medium">قيمة المرتجع</span>
        <Money amount={total} className="text-3xl leading-none" />
      </div>
      {invoice.discountRate > 0 && (
        <p className="text-[11px] text-muted-foreground">
          محسوبة بعد خصم الفاتورة الأصلية ({invoice.discountRate * 100}%).
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => dispatch(requestReturn())}
          className="font-normal sm:me-auto"
        >
          رجوع
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={!valid || !cartEmpty}
          title={
            !cartEmpty
              ? "الفاتورة الحالية فيها أصناف، استخدم الاستبدال"
              : undefined
          }
          onClick={() => submit("returnOnly")}
          className="font-normal"
        >
          مرتجع فقط
        </Button>
        <Button type="submit" size="lg" disabled={!valid}>
          استبدال بصنف آخر
        </Button>
      </div>
    </form>
  );
}
