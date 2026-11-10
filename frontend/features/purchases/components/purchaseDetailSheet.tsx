"use client";

import { IconReceiptRefund } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";

import { Money } from "@/components/shared/Money";
import { listItem, MotionLi } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, parseIsoDay } from "@/lib/dates";
import { formatQty } from "@/lib/format";

import { usePurchase } from "../hooks/usePurchases";
import type { Purchase } from "../types/purchase";
import { PurchaseReturnDialog } from "./purchaseReturnDialog";

function purchaseSubtitle(p: Purchase) {
  return [
    p.supplierName,
    formatDate(parseIsoDay(p.purchasedOn)),
    p.supplierInvoice && `فاتورة المورد ${p.supplierInvoice}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function SummaryRow({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function PurchaseLines({ lines }: { lines: Purchase["lines"] }) {
  return (
    <ul className="divide-y border">
      {lines.map((l, i) => (
        <MotionLi
          key={l.id}
          {...listItem(i)}
          className="flex items-start gap-3 p-2.5"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{l.name}</span>
            <span className="text-[11px] text-muted-foreground">
              {formatQty(l.qty)} {l.unitName} × {l.unitCost}
              {l.returnedQty > 0 && ` · رجع ${formatQty(l.returnedQty)}`}
            </span>
          </span>
          <Money amount={l.lineTotal} className="text-sm" />
        </MotionLi>
      ))}
    </ul>
  );
}

function PurchaseSummary({ p }: { p: Purchase }) {
  return (
    <dl className="space-y-1.5 text-xs">
      {p.discount > 0 && (
        <SummaryRow label="خصم المورد">
          <Money amount={p.discount} />
        </SummaryRow>
      )}
      <div className="flex justify-between">
        <dt className="text-sm font-medium">الإجمالي</dt>
        <dd>
          <Money amount={p.total} className="text-xl" />
        </dd>
      </div>
      <SummaryRow label="مدفوع من الخزنة">
        <Money amount={p.paidAmount} />
      </SummaryRow>
      <SummaryRow label="آجل على الحساب">
        <Money
          amount={p.creditAmount}
          className={p.creditAmount > 0 ? "text-warning" : ""}
        />
      </SummaryRow>
      {p.returnedTotal > 0 && (
        <SummaryRow label="مرتجع للمورد">
          <Money amount={p.returnedTotal} className="text-destructive" />
        </SummaryRow>
      )}
      {p.note && <p className="pt-1 text-muted-foreground">ملاحظة: {p.note}</p>}
    </dl>
  );
}

/** تفاصيل فاتورة شراء + بدء مرتجع للمورد. */
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
            {p ? purchaseSubtitle(p) : "جارٍ التحميل…"}
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
            <PurchaseLines lines={p.lines} />
            <PurchaseSummary p={p} />
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
