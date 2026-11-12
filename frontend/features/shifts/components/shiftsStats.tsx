"use client";

import {
  IconCash,
  IconClockHour4,
  IconReceipt,
  IconScale,
} from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import { StatTile } from "@/components/shared/StatTile";
import { formatWhen } from "@/lib/dates";

import type { Shift } from "../types/shift";
import { ShiftDifference } from "./shiftDifference";

/** المحافظ خارج الدرج: نذكرها حتى لا يظن المدير أن الدرج ناقص. */
function walletHint(shift: Shift | null) {
  const wallets = shift?.walletSales ?? 0;
  if (!wallets) return undefined;
  return (
    <span className="inline-flex items-center gap-1">
      + محافظ <Money amount={wallets} /> خارج الدرج
    </span>
  );
}

const differenceTone = (diff: number | null | undefined) =>
  !diff ? "default" : diff > 0 ? "warning" : "danger";

/** الوردية الحالية + فرق آخر وردية مقفولة. */
export function ShiftsStats({
  current,
  lastClosed,
}: {
  current: Shift | null;
  lastClosed: Shift | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <StatTile
        index={0}
        icon={<IconClockHour4 />}
        label="الوردية الحالية"
        tone={current ? "success" : "warning"}
        hint={
          current
            ? `منذ ${formatWhen(current.openedAt)}`
            : "افتح وردية لبدء البيع"
        }
      >
        {current ? (current.cashierName ?? "مفتوحة") : "لا يوجد"}
      </StatTile>
      <StatTile index={1} icon={<IconReceipt />} label="مبيعات الوردية">
        <Money amount={current?.salesTotal ?? 0} className="text-lg" />
      </StatTile>
      <StatTile
        index={2}
        icon={<IconCash />}
        label="المتوقع في الدرج الآن"
        hint={walletHint(current)}
      >
        <Money amount={current?.expectedCash ?? 0} className="text-lg" />
      </StatTile>
      <StatTile
        index={3}
        icon={<IconScale />}
        label="فرق آخر وردية"
        tone={differenceTone(lastClosed?.difference)}
      >
        <ShiftDifference value={lastClosed?.difference ?? null} />
      </StatTile>
    </div>
  );
}
