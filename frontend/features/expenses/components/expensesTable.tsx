"use client";

import { IconReceipt } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import type {
  AppTableBulkActions,
  AppTableColumn,
  AppTablePaginationProps,
} from "@/components/shared/AppTable/types";
import { Money } from "@/components/shared/Money";
import { Badge } from "@/components/ui/badge";

import { categoryLabel, formatDate } from "../lib/expenseCalc";
import type { Expense } from "../types/expense";
import { ExpenseActionsMenu, type ExpenseActions } from "./expenseActionsMenu";

interface Props extends ExpenseActions {
  expenses: Expense[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  isFiltered: boolean;
  onClearFilters: () => void;
  emptyAction: ReactNode;
  pagination: AppTablePaginationProps;
  bulkActions: AppTableBulkActions<Expense>;
}

/** جدول المصاريف فوق AppTable. الضغط على الصف يفتح التعديل. */
export function ExpensesTable({
  expenses,
  isLoading,
  isFetching,
  isError,
  errorMessage,
  onRetry,
  isFiltered,
  onClearFilters,
  emptyAction,
  pagination,
  bulkActions,
  ...actions
}: Props) {
  const columns: AppTableColumn<Expense>[] = [
    {
      id: "date",
      header: "التاريخ",
      skeletonClassName: "w-24",
      cellClassName: "whitespace-nowrap text-muted-foreground",
      cell: (e) => formatDate(e.spentAt),
    },
    {
      id: "category",
      header: "النوع",
      cell: (e) => (
        <Badge variant="outline" className="font-normal">
          {categoryLabel(e.category)}
        </Badge>
      ),
    },
    {
      id: "note",
      header: "الملاحظة",
      className: "hidden md:table-cell",
      skeletonClassName: "w-40",
      cell: (e) => (
        <span className="block max-w-64 truncate text-xs">
          {e.note || <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      id: "amount",
      header: "المبلغ",
      cell: (e) => <Money amount={e.amount} className="text-sm" />,
    },
    {
      id: "createdBy",
      header: "سجّله",
      className: "hidden lg:table-cell",
      cellClassName: "text-muted-foreground",
      cell: (e) => e.createdByName ?? "—",
    },
    {
      id: "actions",
      header: <span className="sr-only">إجراءات</span>,
      className: "w-12 pe-2",
      cell: (e) => <ExpenseActionsMenu expense={e} {...actions} />,
    },
  ];

  return (
    <AppTable
      data={expenses}
      columns={columns}
      getRowId={(e) => e.id}
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      errorMessage={errorMessage}
      onRetry={onRetry}
      empty={{
        icon: IconReceipt,
        title: "لا توجد مصاريف بعد",
        description: "سجّل أول مصروف (إيجار، كهرباء، رواتب…) لتتابع خزنتك.",
        action: emptyAction,
      }}
      noResults={{ title: "لا توجد مصاريف مطابقة" }}
      isFiltered={isFiltered}
      onClearFilters={onClearFilters}
      onRowClick={(e) => actions.onEdit(e.id)}
      selectable
      getRowLabel={(e) => `${categoryLabel(e.category)} - ${formatDate(e.spentAt)}`}
      bulkActions={bulkActions}
      pagination={pagination}
    />
  );
}