"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Money } from "@/components/shared/Money";
import { OptionSelect } from "@/components/shared/OptionSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUPPLIER_ROUTES } from "@/features/suppliers/config/supplierRoutes";

import {
  PURCHASE_FIELD_IDS as IDS,
  PURCHASE_LIMITS,
} from "../config/purchaseOptions";
import type { PurchaseDraft } from "../hooks/usePurchaseDraft";
import { usePurchaseSuppliers } from "../hooks/usePurchases";

function SupplierField({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const suppliers = usePurchaseSuppliers();
  const items = useMemo(
    () => [
      {
        value: "",
        label: suppliers.isPending ? "جارٍ التحميل…" : "اختر المورد",
      },
      ...(suppliers.data ?? [])
        .filter((s) => s.isActive)
        .map((s) => ({ value: s.id, label: s.name })),
    ],
    [suppliers.data, suppliers.isPending],
  );
  const selected = suppliers.data?.find((s) => s.id === value);

  return (
    <div className="space-y-1.5">
      <Label>المورد *</Label>
      <OptionSelect
        label="المورد"
        items={items}
        value={value}
        onChange={onChange}
        className="w-full"
      />
      {selected && (
        <p className="text-[11px] text-muted-foreground">
          رصيده الحالي:{" "}
          <Money amount={selected.balance} className="text-[11px]" />
        </p>
      )}
      {suppliers.data?.length === 0 && (
        <Link
          href={SUPPLIER_ROUTES.new}
          className="text-[11px] text-primary underline"
        >
          أضف أول مورد
        </Link>
      )}
    </div>
  );
}

/** المورد ورقم فاتورته وتاريخها. */
export function PurchaseHeaderFields({
  header,
}: {
  header: PurchaseDraft["header"];
}) {
  return (
    <section className="grid gap-3 border bg-card p-3 sm:grid-cols-3">
      <SupplierField
        value={header.supplierId}
        onChange={header.setSupplierId}
      />

      <div className="space-y-1.5">
        <Label htmlFor={IDS.supplierInvoice}>رقم فاتورة المورد</Label>
        <Input
          id={IDS.supplierInvoice}
          value={header.supplierInvoice}
          maxLength={PURCHASE_LIMITS.supplierInvoice}
          onChange={(e) => header.setSupplierInvoice(e.target.value)}
          placeholder="اختياري"
          dir="ltr"
          className="h-10 font-mono"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={IDS.date}>تاريخ الفاتورة</Label>
        <Input
          id={IDS.date}
          type="date"
          value={header.date}
          onChange={(e) => e.target.value && header.setDate(e.target.value)}
          dir="ltr"
          className="h-10 font-mono"
        />
      </div>
    </section>
  );
}
