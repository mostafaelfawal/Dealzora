"use client";

import {
  IconAlertTriangle,
  IconBuildingWarehouse,
  IconClockPause,
  IconPackageOff,
} from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import { Num } from "@/components/shared/Num";
import { StatTile } from "@/components/shared/StatTile";

import type { InventoryTab, StockReport } from "../types/inventory";

/** أرقام المخزون. كل بطاقة تفتح التبويب المقابل. */
export function InventoryStats({
  report: r,
  tab,
  stagnantDays,
  onTabChange,
}: {
  report: StockReport | undefined;
  tab: InventoryTab;
  stagnantDays: string;
  onTabChange: (tab: InventoryTab) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <StatTile
        index={0}
        icon={<IconBuildingWarehouse />}
        label="قيمة المخزون (بسعر الشراء)"
        active={tab === "all"}
        onClick={() => onTabChange("all")}
      >
        <Money amount={r?.stockValue ?? 0} className="text-lg" />
      </StatTile>
      <StatTile
        index={1}
        icon={<IconAlertTriangle />}
        label="قارب على النفاد"
        tone="warning"
        active={tab === "low"}
        onClick={() => onTabChange("low")}
      >
        <Num>{r?.low.length ?? 0}</Num>
      </StatTile>
      <StatTile
        index={2}
        icon={<IconPackageOff />}
        label="نفد من المخزون"
        tone="danger"
        active={tab === "out"}
        onClick={() => onTabChange("out")}
      >
        <Num>{r?.out.length ?? 0}</Num>
      </StatTile>
      <StatTile
        index={3}
        icon={<IconClockPause />}
        label={`راكد (${stagnantDays} يوماً بلا بيع)`}
        active={tab === "stagnant"}
        onClick={() => onTabChange("stagnant")}
        hint={
          r ? (
            <>
              مجمّد فيه{" "}
              <Money amount={r.stagnantValue} className="text-[11px]" />
            </>
          ) : undefined
        }
      >
        <Num>{r?.stagnant.length ?? 0}</Num>
      </StatTile>
    </div>
  );
}
