"use client";

import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconWallet,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import type {
  AppTableColumn,
  AppTablePaginationProps,
} from "@/components/shared/AppTable/types";
import { cn } from "@/lib/utils";

import { formatDayLabel } from "../lib/treasuryCalc";
import type { CashEntry } from "../types/treasury";
import {
  TreasuryActionsMenu,
  type TreasuryActions,
} from "./treasuryActionsMenu";
import { TreasuryAmount } from "./treasuryAmount";
import { TreasuryEntryBadges } from "./treasuryEntryBadges";

interface Props extends TreasuryActions {
  entries: CashEntry[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  isFiltered: boolean;
  onClearFilters: () => void;
  emptyAction: ReactNode;
  pagination: AppTablePaginationProps;
}

/** جدول حركات الخزنة فوق AppTable (بدون تحديد جماعي: الحذف للحركات اليدوية فقط). */
export function TreasuryTable({
  entries,
  isLoading,
  isFetching,
  isError,
  errorMessage,
  onRetry,
  isFiltered,
  onClearFilters,
  emptyAction,
  pagination,
  ...actions
}: Props) {
  const columns: AppTableColumn<CashEntry>[] = [
    {
      id: "entry",
      header: "الحركة",
      skeletonClassName: "w-48",
      cell: (e) => {
        const Icon =
          e.direction === "in" ? IconArrowDownLeft : IconArrowUpRight;
        return (
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              aria-hidden
              className={cn(
                "flex size-8 shrink-0 items-center justify-center [&_svg]:size-4",
                e.direction === "in"
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              <Icon />
            </span>
            <div className="min-w-0">
              <p className="max-w-64 truncate text-xs font-medium">
                {e.note || "بدون ملاحظة"}
              </p>
              <span className="mt-1 flex flex-wrap gap-1">
                <TreasuryEntryBadges entry={e} />
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "amount",
      header: "المبلغ",
      cell: (e) => (
        <TreasuryAmount
          direction={e.direction}
          amount={e.amount}
          className="text-sm"
        />
      ),
    },
    {
      id: "date",
      header: "التاريخ",
      className: "hidden md:table-cell",
      cellClassName: "text-muted-foreground",
      cell: (e) => formatDayLabel(e.occurredAt),
    },
    {
      id: "by",
      header: "بواسطة",
      className: "hidden lg:table-cell",
      cellClassName: "text-muted-foreground",
      cell: (e) => e.createdByName ?? "—",
    },
    {
      id: "actions",
      header: <span className="sr-only">إجراءات</span>,
      className: "w-12 pe-2",
      cell: (e) => <TreasuryActionsMenu entry={e} {...actions} />,
    },
  ];

  return (
    <AppTable
      data={entries}
      columns={columns}
      getRowId={(e) => e.id}
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      errorMessage={errorMessage}
      onRetry={onRetry}
      empty={{
        icon: IconWallet,
        title: "لا توجد حركات في الخزنة بعد",
        description:
          "ابدأ برصيد افتتاحي. بعدها تظهر مصروفاتك هنا تلقائياً، ويمكنك تسجيل أي إيداع أو سحب يدوي.",
        action: emptyAction,
      }}
      noResults={{
        title: "لا توجد حركات مطابقة",
        description: "جرّب فترة أو نوعاً آخر، أو امسح الفلاتر.",
      }}
      isFiltered={isFiltered}
      onClearFilters={onClearFilters}
      rowHeightClassName="h-16"
      pagination={pagination}
    />
  );
}
