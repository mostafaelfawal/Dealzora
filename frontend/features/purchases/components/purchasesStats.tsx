"use client";

import {
  IconCalendarMonth,
  IconCash,
  IconReceiptRefund,
  IconTruckDelivery,
} from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import { StatTile } from "@/components/shared/StatTile";

import { usePurchasesSummary } from "../hooks/usePurchases";
import type { PurchaseStatusFilter } from "../types/purchase";

/** أرقام الشهر. بطاقتا الآجل والمرتجع تعملان كفلتر سريع. */
export function PurchasesStats({
  status,
  onStatusChange,
}: {
  status: PurchaseStatusFilter;
  onStatusChange: (status: PurchaseStatusFilter) => void;
}) {
  const summary = usePurchasesSummary().data;
  const monthTotal = summary?.monthTotal ?? 0;
  const monthPaid = summary?.monthPaid ?? 0;

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <StatTile
        index={0}
        icon={<IconCalendarMonth />}
        label="مشتريات الشهر"
        hint={summary ? `${summary.monthCount} فاتورة` : undefined}
      >
        <Money amount={monthTotal} className="text-lg" />
      </StatTile>
      <StatTile index={1} icon={<IconCash />} label="مدفوع هذا الشهر">
        <Money amount={monthPaid} className="text-lg" />
      </StatTile>
      <StatTile
        index={2}
        icon={<IconTruckDelivery />}
        label="آجل هذا الشهر"
        tone="warning"
        onClick={() => onStatusChange("credit")}
        active={status === "credit"}
      >
        <Money
          amount={Math.max(monthTotal - monthPaid, 0)}
          className="text-lg"
        />
      </StatTile>
      <StatTile
        index={3}
        icon={<IconReceiptRefund />}
        label="مرتجع للموردين"
        onClick={() => onStatusChange("returned")}
        active={status === "returned"}
      >
        <Money amount={summary?.returnsMonth ?? 0} className="text-lg" />
      </StatTile>
    </div>
  );
}
