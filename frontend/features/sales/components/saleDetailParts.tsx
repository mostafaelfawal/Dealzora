"use client";

import type { ReactNode } from "react";

import { Money } from "@/components/shared/Money";
import { listItem, MotionLi } from "@/components/shared/motion";
import { Separator } from "@/components/ui/separator";
import { formatQty } from "@/lib/format";

import { PAYMENT_LABEL } from "../config/saleOptions";
import type { Sale } from "../types/sale";

/** أجزاء عرض الفاتورة داخل SaleDetailSheet. */

function Row({
  label,
  children,
  strong,
}: {
  label: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={strong ? "text-sm font-medium" : "text-muted-foreground"}>
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

export function SaleLinesList({ lines }: { lines: Sale["lines"] }) {
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
            <span className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
              {formatQty(l.qty)} {l.unitName} ×
              <Money amount={l.unitPrice} className="text-[11px]" />
              {l.discount > 0 && (
                <span className="text-warning">
                  · خصم <Money amount={l.discount} className="text-[11px]" />
                </span>
              )}
              {l.returnedQty > 0 && (
                <span className="text-destructive">
                  · رجع {formatQty(l.returnedQty)}
                </span>
              )}
            </span>
          </span>
          <Money amount={l.lineTotal} className="text-sm" />
        </MotionLi>
      ))}
    </ul>
  );
}

/** المجاميع وطريقة الدفع والمرتجع والربح. الصفوف الصفرية لا تظهر. */
export function SaleTotals({ sale }: { sale: Sale }) {
  const discount = sale.linesDiscount + sale.invoiceDiscount;
  return (
    <dl className="space-y-1.5 text-xs">
      <Row label="الإجمالي قبل الخصم">
        <Money amount={sale.subtotal} />
      </Row>
      {discount > 0 && (
        <Row label="الخصم">
          <Money amount={discount} />
        </Row>
      )}
      <Row label="الإجمالي" strong>
        <Money amount={sale.total} className="text-xl" />
      </Row>
      <Separator className="my-2" />
      {sale.cashAmount > 0 && (
        <Row label="كاش">
          <Money amount={sale.cashAmount} />
        </Row>
      )}
      {sale.change > 0 && (
        <Row label={`استلم ${sale.received} والباقي`}>
          <Money amount={sale.change} />
        </Row>
      )}
      {sale.creditAmount > 0 && (
        <Row label={`آجل على ${sale.customerName ?? "العميل"}`}>
          <Money amount={sale.creditAmount} className="text-warning" />
        </Row>
      )}
      {sale.walletAmount > 0 && (
        <Row label={PAYMENT_LABEL[sale.paymentMethod]}>
          <Money amount={sale.walletAmount} />
        </Row>
      )}
      {sale.walletAmount > 0 && sale.paymentRef && (
        <Row label="رقم العملية">
          <bdi dir="ltr" className="font-mono">
            {sale.paymentRef}
          </bdi>
        </Row>
      )}
      {sale.returnedTotal > 0 && (
        <Row label="مرتجع">
          <Money amount={sale.returnedTotal} className="text-destructive" />
        </Row>
      )}
      {sale.profit !== null && (
        <Row label="صافي الربح">
          <Money
            amount={sale.profit}
            className={sale.profit < 0 ? "text-destructive" : "text-success"}
          />
        </Row>
      )}
      {sale.note && (
        <p className="pt-1 text-muted-foreground">ملاحظة: {sale.note}</p>
      )}
    </dl>
  );
}
