"use client";

import { cn } from "cn";
import type { InvoiceTotals } from "../lib/posCalc";
import type { CartLine, PosInvoice } from "../types/pos";

import { PosCartHeader } from "./posCartHeader";
import { PosCartTable } from "./posCartTable";
import { PosTotals } from "./posTotals";

interface PosCartPanelProps {
  className?: string;
  invoice: PosInvoice;
  totals: InvoiceTotals;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSetQty: (id: string, qty: number) => void;
  onStep: (id: string, direction: 1 | -1) => void;
  onRemove: (id: CartLine["productId"]) => void;
  onFocusSearch: () => void;
  onCustomer: () => void;
  onCancel: () => void;
  onBack: () => void;
  onHold: () => void;
  onDiscount: () => void;
  onRemoveDiscount: () => void;
  onPay: () => void;
}

/** العمود الثاني: الفاتورة (جدول) + الإجمالي والدفع. */
export function PosCartPanel({
  className,
  invoice,
  totals,
  selectedId,
  onSelect,
  onSetQty,
  onStep,
  onRemove,
  onFocusSearch,
  onCustomer,
  onCancel,
  onBack,
  onHold,
  onDiscount,
  onRemoveDiscount,
  onPay,
}: PosCartPanelProps) {
  return (
    <section
      aria-label="الفاتورة"
      className={cn("min-h-0 flex-col bg-background", className)}
    >
      <PosCartHeader
        customer={invoice.customer}
        itemCount={totals.itemCount}
        onCustomer={onCustomer}
        onCancel={onCancel}
        onBack={onBack}
      />
      <PosCartTable
        lines={invoice.lines}
        selectedId={selectedId}
        onSelect={onSelect}
        onSetQty={onSetQty}
        onStep={onStep}
        onRemove={onRemove}
        onFocusSearch={onFocusSearch}
      />
      <PosTotals
        totals={totals}
        discount={invoice.discount}
        onHold={onHold}
        onDiscount={onDiscount}
        onRemoveDiscount={onRemoveDiscount}
        onPay={onPay}
      />
    </section>
  );
}
