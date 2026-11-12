"use client";

import { IconClockHour4 } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import {
  CardFoot,
  CardHead,
  CardStats,
} from "@/components/shared/AppTable/AppTableCards";
import type { AppTableColumn } from "@/components/shared/AppTable/types";
import { Money } from "@/components/shared/Money";
import { Badge } from "@/components/ui/badge";
import type { ViewMode } from "@/hooks/useViewMode";
import { formatWhen } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";

import { SHIFT_PAGE_SIZES } from "../config/shiftOptions";
import type { useShiftsList } from "../hooks/useShifts";
import type { Shift } from "../types/shift";
import { ShiftDifference } from "./shiftDifference";
import { AppTooltip } from "@/components/shared/AppTooltip";

const Dash = () => <span className="text-muted-foreground">—</span>;

const COLUMNS: AppTableColumn<Shift>[] = [
  {
    id: "cashier",
    header: "الوردية",
    skeletonClassName: "w-40",
    cell: (s) => (
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-medium">
          {s.cashierName ?? "—"}
          {s.isOpen && <Badge className="font-normal">مفتوحة الآن</Badge>}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {s.deviceName && (
            <span className="text-foreground/80">{s.deviceName} · </span>
          )}
          {formatWhen(s.openedAt)}
          {s.closedAt && ` ← ${formatWhen(s.closedAt)}`}
        </p>
      </div>
    ),
  },
  {
    id: "sales",
    header: "المبيعات",
    cell: (s) => (
      <div className="text-xs">
        <Money amount={s.salesTotal ?? 0} className="text-sm" />
        <p className="text-[11px] text-muted-foreground">
          {s.salesCount} فاتورة
          {s.returnsCount > 0 && ` · ${s.returnsCount} مرتجع`}
        </p>
      </div>
    ),
  },
  {
    id: "expected",
    header: "المتوقع في الدرج",
    className: "hidden md:table-cell",
    cell: (s) => <Money amount={s.expectedCash ?? 0} className="text-sm" />,
  },
  {
    id: "counted",
    header: "الفعلي",
    className: "hidden md:table-cell",
    cell: (s) =>
      s.countedCash === null ? (
        <Dash />
      ) : (
        <Money amount={s.countedCash} className="text-sm" />
      ),
  },
  {
    id: "diff",
    header: "الفرق",
    cell: (s) => <ShiftDifference value={s.isOpen ? null : s.difference} />,
  },
  {
    id: "note",
    header: "ملاحظة",
    className: "hidden xl:table-cell",
    cellClassName: "max-w-48 truncate text-xs text-muted-foreground",
    cell: (s) => (
      <AppTooltip message={s.note || "لا يوجد ملاحظات"}>
        <span>{s.note || "—"}</span>
      </AppTooltip>
    ),
  },
];

/** بطاقة وردية: الكاشير والمبيعات، ثم جرد الدرج (المتوقع والفعلي والفرق). */
function ShiftCard({ shift: s }: { shift: Shift }) {
  return (
    <>
      <CardHead
        title={
          <span className="flex items-center gap-2">
            {s.cashierName ?? "—"}
            {s.isOpen && <Badge className="font-normal">مفتوحة الآن</Badge>}
          </span>
        }
        subtitle={s.deviceName ?? undefined}
        aside={<ShiftDifference value={s.isOpen ? null : s.difference} />}
      />
      <div className="space-y-0.5">
        <Money amount={s.salesTotal ?? 0} className="text-lg font-semibold" />
        <p className="text-[11px] text-muted-foreground">
          {s.salesCount} فاتورة
          {s.returnsCount > 0 && ` · ${s.returnsCount} مرتجع`}
        </p>
      </div>
      <CardStats
        items={[
          {
            label: "المتوقع في الدرج",
            value: <Money amount={s.expectedCash ?? 0} className="text-xs" />,
          },
          {
            label: "الفعلي",
            value:
              s.countedCash === null ? (
                <Dash />
              ) : (
                <Money amount={s.countedCash} className="text-xs" />
              ),
          },
        ]}
      />
      {s.note && (
        <p className="line-clamp-2 text-[11px] text-muted-foreground">
          {s.note}
        </p>
      )}
      <CardFoot>
        <span>
          {formatWhen(s.openedAt)}
          {s.closedAt && ` ← ${formatWhen(s.closedAt)}`}
        </span>
      </CardFoot>
    </>
  );
}

export function ShiftsTable({
  list,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  emptyAction,
  view,
}: {
  view: ViewMode;
  list: ReturnType<typeof useShiftsList>;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  emptyAction: ReactNode;
}) {
  return (
    <AppTable
      data={list.data?.items ?? []}
      columns={COLUMNS}
      getRowId={(s) => s.id}
      isLoading={list.isPending}
      isFetching={list.isFetching}
      isError={list.isError}
      errorMessage={extractErrorMessage(list.error, "تعذّر تحميل الورديات")}
      onRetry={() => list.refetch()}
      empty={{
        icon: IconClockHour4,
        title: "لا توجد ورديات بعد",
        description: "افتح أول وردية لتبدأ البيع من شاشة الكاشير.",
        action: emptyAction,
      }}
      rowHeightClassName="h-16"
      view={view}
      renderCard={(s) => <ShiftCard shift={s} />}
      cardClassName={(s) => (s.isOpen ? "border-primary/60" : undefined)}
      pagination={{
        total: list.data?.total ?? 0,
        page,
        pageSize,
        onPageChange,
        onPageSizeChange,
        pageSizes: SHIFT_PAGE_SIZES,
        itemsLabel: "الورديات",
      }}
    />
  );
}
