"use client";

import { IconArrowRight } from "@tabler/icons-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHotkey } from "@/hooks/useHotkey";

import {
  PURCHASE_FIELD_IDS as IDS,
  PURCHASE_FORM_SHORTCUTS,
  PURCHASE_LIMITS,
} from "../config/purchaseOptions";
import { PURCHASE_ROUTES } from "../config/purchaseRoutes";
import { usePurchaseDraft } from "../hooks/usePurchaseDraft";
import { PurchaseHeaderFields } from "./purchaseHeaderFields";
import { PurchaseLinesTable } from "./purchaseLinesTable";
import { PurchaseProductSearch } from "./purchaseProductSearch";
import { PurchaseTotalsPanel } from "./purchaseTotalsPanel";

/** فاتورة شراء جديدة: المورد ← الأصناف (باركود أو اسم) ← المدفوع ← F9 للحفظ. */
export function PurchaseFormScreen() {
  const draft = usePurchaseDraft();

  useHotkey(PURCHASE_FORM_SHORTCUTS.save.match, () => draft.submit(false));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="فاتورة شراء جديدة"
        description="الأصناف تدخل المخزون ويتحدث متوسط سعر الشراء تلقائياً. الجزء غير المدفوع يُضاف لحساب المورد."
        actions={
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<Link href={PURCHASE_ROUTES.list} />}
            className="h-10 gap-2 font-normal"
          >
            <IconArrowRight className="size-4" />
            المشتريات
          </Button>
        }
      />

      <PurchaseHeaderFields header={draft.header} />

      <PurchaseProductSearch
        inputRef={draft.searchRef}
        onPick={draft.addProduct}
      />

      <PurchaseLinesTable
        lines={draft.lines}
        lineErrors={draft.lineErrors}
        showErrors={draft.submitted}
        onPatch={draft.patchLine}
        onRemove={draft.removeLine}
      />

      <section className="grid gap-4 lg:grid-cols-[1fr_minmax(320px,380px)]">
        <div className="space-y-1.5">
          <Label htmlFor={IDS.note}>ملاحظة</Label>
          <Input
            id={IDS.note}
            value={draft.note}
            maxLength={PURCHASE_LIMITS.note}
            onChange={(e) => draft.setNote(e.target.value)}
            placeholder="اختياري"
          />
        </div>
        <PurchaseTotalsPanel draft={draft} />
      </section>
    </div>
  );
}
