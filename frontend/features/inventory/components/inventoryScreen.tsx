"use client";

import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { useHotkey } from "@/hooks/useHotkey";

import { INVENTORY_SHORTCUTS } from "../config/inventoryOptions";
import { useInventoryList } from "../hooks/useInventoryList";
import { toAdjustTarget } from "../lib/inventoryRows";
import type { AdjustTarget } from "../types/inventory";
import { AdjustStockDialog } from "./adjustStockDialog";
import { InventoryStats } from "./inventoryStats";
import { InventoryTable } from "./inventoryTable";
import { InventoryToolbar } from "./inventoryToolbar";
import { LedgerSheet } from "./ledgerSheet";

/** المخزون: الأرصدة والنواقص والراكد + الجرد والتالف وحركة كل صنف. */
export function InventoryScreen() {
  const list = useInventoryList();
  const [ledgerFor, setLedgerFor] = useState<AdjustTarget | null>(null);
  const [adjustFor, setAdjustFor] = useState<AdjustTarget | null>(null);

  // F4 من داخل نافذة الحركة = تعديل نفس الصنف.
  useHotkey(INVENTORY_SHORTCUTS.adjust.match, () => {
    if (ledgerFor && !adjustFor) setAdjustFor(ledgerFor);
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="المخزون"
        description="تابع النواقص والراكد، وسجّل الجرد والتالف والهدايا. كل تعديل يظهر في حركة الصنف وسجل العمليات."
      />

      <InventoryStats
        report={list.report}
        tab={list.tab}
        stagnantDays={list.stagnantDays}
        onTabChange={list.setTab}
      />

      <InventoryToolbar list={list} />

      <InventoryTable
        list={list}
        onAdjust={(row) => setAdjustFor(toAdjustTarget(row))}
        onLedger={(row) => setLedgerFor(toAdjustTarget(row))}
      />

      <LedgerSheet
        target={ledgerFor}
        onClose={() => setLedgerFor(null)}
        onAdjust={setAdjustFor}
      />
      <AdjustStockDialog
        target={adjustFor}
        onClose={() => {
          setAdjustFor(null);
          setLedgerFor(null);
        }}
      />
    </div>
  );
}
