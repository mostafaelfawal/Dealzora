"use client";

import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { ViewToggle } from "@/components/shared/ViewToggle";
import { Button } from "@/components/ui/button";
import { useHotkey } from "@/hooks/useHotkey";
import { useViewMode } from "@/hooks/useViewMode";

import { PURCHASES_SHORTCUTS } from "../config/purchaseOptions";
import { PURCHASE_ROUTES } from "../config/purchaseRoutes";
import { usePurchasesFilters } from "../hooks/usePurchasesFilters";
import { PurchaseDetailSheet } from "./purchaseDetailSheet";
import { PurchasesStats } from "./purchasesStats";
import { PurchasesTable } from "./purchasesTable";
import { PurchasesToolbar } from "./purchasesToolbar";

/** قائمة فواتير الشراء: أرقام الشهر + بحث وفلاتر + جدول + تفاصيل الفاتورة. */
export function PurchasesScreen() {
  const router = useRouter();
  const filters = usePurchasesFilters();
  const [openId, setOpenId] = useState<string | null>(null);
  const { view, setView } = useViewMode("purchases");

  useHotkey(
    PURCHASES_SHORTCUTS.newPurchase.match,
    () => openId === null && router.push(PURCHASE_ROUTES.new),
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="المشتريات"
        description="فواتير الشراء من الموردين. كل فاتورة تزيد المخزون وتحدّث سعر الشراء تلقائياً."
        actions={
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href={PURCHASE_ROUTES.new} />}
            className="h-10 gap-2"
          >
            <IconPlus className="size-4" />
            فاتورة شراء
            <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
              {PURCHASES_SHORTCUTS.newPurchase.label}
            </ShortcutBadge>
          </Button>
        }
      />

      <PurchasesStats
        status={filters.status}
        onStatusChange={filters.setStatus}
      />

      <PurchasesToolbar
        search={filters.search}
        onSearchChange={filters.setSearch}
        period={filters.period}
        onPeriodChange={filters.setPeriod}
        status={filters.status}
        onStatusChange={filters.setStatus}
        viewToggle={
          <ViewToggle
            view={view}
            onChange={setView}
            hotkey={openId === null}
          />
        }
      />

      <PurchasesTable
        filters={filters}
        view={view}
        onOpen={setOpenId}
        emptyAction={
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href={PURCHASE_ROUTES.new} />}
            className="gap-2"
          >
            <IconPlus className="size-4" />
            فاتورة شراء جديدة
          </Button>
        }
      />

      <PurchaseDetailSheet
        purchaseId={openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
