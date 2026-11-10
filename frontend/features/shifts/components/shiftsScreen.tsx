"use client";

import {
  IconCash,
  IconClockHour4,
  IconLockDollar,
  IconPlayerPlay,
  IconReceipt,
  IconScale,
} from "@tabler/icons-react";
import { useState } from "react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import type { AppTableColumn } from "@/components/shared/AppTable/types";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { StatTile } from "@/components/shared/StatTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHotkey } from "@/hooks/useHotkey";
import { formatWhen } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { plain } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

import { useCurrentShift, useShiftsList } from "../hooks/useShifts";
import type { Shift } from "../types/shift";
import { CloseShiftDialog, OpenShiftDialog } from "./shiftDialogs";

const PAGE_SIZES = [12, 24, 48];
const SHIFT_KEY = { label: "F4", match: plain("F4") };

function Difference({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  if (value === 0)
    return (
      <Badge
        variant="outline"
        className="border-success/50 font-normal text-success"
      >
        مطابق
      </Badge>
    );
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 text-xs",
        value > 0 ? "text-warning" : "text-destructive",
      )}
    >
      {value > 0 ? "زيادة" : "عجز"}
      <Money amount={Math.abs(value)} className="text-xs" />
    </span>
  );
}

/** الورديات: الوردية الحالية + سجل الورديات السابقة بالمتوقع والفعلي والفرق. */
export function ShiftsScreen() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [dialog, setDialog] = useState<"open" | "close" | null>(null);
  const list = useShiftsList(page, pageSize);
  const current = useCurrentShift();
  const shift = current.data ?? null;
  const last = list.data?.items.find((s) => !s.isOpen) ?? null;

  useHotkey(SHIFT_KEY.match, () => {
    if (dialog) return;
    setDialog(shift ? "close" : "open");
  });

  const columns: AppTableColumn<Shift>[] = [
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
          <span className="text-muted-foreground">—</span>
        ) : (
          <Money amount={s.countedCash} className="text-sm" />
        ),
    },
    {
      id: "diff",
      header: "الفرق",
      cell: (s) => <Difference value={s.isOpen ? null : s.difference} />,
    },
    {
      id: "note",
      header: "ملاحظة",
      className: "hidden xl:table-cell",
      cellClassName: "max-w-48 truncate text-xs text-muted-foreground",
      cell: (s) => s.note || "—",
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="الورديات"
        description="كل وردية تبدأ بفكّة الدرج وتنتهي بجرده. الفرق (عجز أو زيادة) يُسجَّل في الخزنة تلقائياً."
        actions={
          <Button
            size="lg"
            variant={shift ? "outline" : "default"}
            onClick={() => setDialog(shift ? "close" : "open")}
            className="h-10 gap-2"
          >
            {shift ? (
              <IconLockDollar className="size-4" />
            ) : (
              <IconPlayerPlay className="size-4" />
            )}
            {shift ? "قفل الوردية الحالية" : "فتح وردية"}
            <ShortcutBadge className="hidden lg:inline-flex">
              {SHIFT_KEY.label}
            </ShortcutBadge>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile
          index={0}
          icon={<IconClockHour4 />}
          label="الوردية الحالية"
          tone={shift ? "success" : "warning"}
          hint={
            shift
              ? `منذ ${formatWhen(shift.openedAt)}`
              : "افتح وردية لبدء البيع"
          }
        >
          {shift ? (shift.cashierName ?? "مفتوحة") : "لا يوجد"}
        </StatTile>
        <StatTile index={1} icon={<IconReceipt />} label="مبيعات الوردية">
          <Money amount={shift?.salesTotal ?? 0} className="text-lg" />
        </StatTile>
        <StatTile index={2} icon={<IconCash />} label="المتوقع في الدرج الآن">
          <Money amount={shift?.expectedCash ?? 0} className="text-lg" />
        </StatTile>
        <StatTile
          index={3}
          icon={<IconScale />}
          label="فرق آخر وردية"
          tone={
            !last?.difference
              ? "default"
              : last.difference > 0
                ? "warning"
                : "danger"
          }
        >
          <Difference value={last?.difference ?? null} />
        </StatTile>
      </div>

      <AppTable
        data={list.data?.items ?? []}
        columns={columns}
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
          action: (
            <Button
              size="lg"
              onClick={() => setDialog("open")}
              className="gap-2"
            >
              <IconPlayerPlay className="size-4" />
              فتح وردية
            </Button>
          ),
        }}
        rowHeightClassName="h-16"
        pagination={{
          total: list.data?.total ?? 0,
          page,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
          pageSizes: PAGE_SIZES,
          itemsLabel: "الورديات",
        }}
      />

      <OpenShiftDialog
        open={dialog === "open"}
        onClose={() => setDialog(null)}
      />
      <CloseShiftDialog
        shift={shift}
        open={dialog === "close"}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
