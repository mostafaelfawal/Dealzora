"use client";

import { IconCash, IconPhone, IconUsers } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import type {
  AppTableBulkActions,
  AppTableColumn,
  AppTablePaginationProps,
} from "@/components/shared/AppTable/types";
import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { formatDaysAgo } from "../lib/customerCalc";
import type { Customer } from "../types/customer";
import {
  CustomerActionsMenu,
  type CustomerActions,
} from "./customerActionsMenu";
import { CustomerCreditMeter } from "./customerCreditMeter";
import { CustomerStatusBadges } from "./customerStatusBadges";

interface Props extends CustomerActions {
  customers: Customer[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  isFiltered: boolean;
  onClearFilters: () => void;
  emptyAction: ReactNode;
  pagination: AppTablePaginationProps;
  bulkActions: AppTableBulkActions<Customer>;
}

/** جدول العملاء فوق AppTable. الضغط على الصف يفتح كشف الحساب. */
export function CustomersTable({
  customers,
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
  const columns: AppTableColumn<Customer>[] = [
    {
      id: "customer",
      header: "العميل",
      skeletonClassName: "w-40",
      cell: (c) => (
        <div className={cn("min-w-0", !c.isActive && "opacity-60")}>
          <button
            type="button"
            onClick={() => actions.onStatement(c.id)}
            className="block max-w-56 truncate text-start text-xs font-medium outline-none hover:underline focus-visible:underline"
          >
            {c.name}
          </button>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <IconPhone className="size-3.5" aria-hidden />
            <span dir="ltr" className="font-mono">
              {c.phone || "بدون رقم"}
            </span>
          </span>
          <span className="mt-1 flex flex-wrap gap-1 empty:hidden">
            <CustomerStatusBadges customer={c} />
          </span>
        </div>
      ),
    },
    {
      id: "balance",
      header: "المديونية",
      cell: (c) =>
        c.balance > 0 ? (
          <div className="flex items-center gap-2">
            <Money amount={c.balance} className="text-sm text-destructive" />
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label={`تحصيل دفعة من ${c.name}`}
              onClick={() => actions.onCollect(c.id)}
              className="size-7"
            >
              <IconCash />
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">لا مديونية</span>
        ),
    },
    {
      id: "credit",
      header: "الحد الائتماني",
      className: "hidden w-48 md:table-cell",
      cell: (c) => <CustomerCreditMeter customer={c} />,
    },
    {
      id: "lastPurchase",
      header: "آخر شراء",
      className: "hidden lg:table-cell",
      cellClassName: "text-muted-foreground",
      cell: (c) => formatDaysAgo(c.lastPurchaseAt),
    },
    {
      id: "lastPayment",
      header: "آخر دفعة",
      className: "hidden lg:table-cell",
      cellClassName: "text-muted-foreground",
      cell: (c) => formatDaysAgo(c.lastPaymentAt),
    },
    {
      id: "active",
      header: "مفعّل",
      className: "w-20",
      cell: (c) => (
        <Switch
          size="sm"
          checked={c.isActive}
          onCheckedChange={() => actions.onToggleActive(c.id)}
          aria-label={`${c.isActive ? "تعطيل" : "تفعيل"} ${c.name}`}
        />
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">إجراءات</span>,
      className: "w-12 pe-2",
      cell: (c) => <CustomerActionsMenu customer={c} {...actions} />,
    },
  ];

  return (
    <AppTable
      data={customers}
      columns={columns}
      getRowId={(c) => c.id}
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      errorMessage={errorMessage}
      onRetry={onRetry}
      empty={{
        icon: IconUsers,
        title: "لا يوجد عملاء بعد",
        description:
          "أضف عملاءك الدائمين لتبيع لهم بالآجل وتتابع مديونياتهم وتحصّل دفعاتهم من مكان واحد.",
        action: emptyAction,
      }}
      noResults={{
        title: "لا يوجد عملاء مطابقون",
        description: "جرّب جزءاً من الاسم أو آخر أرقام الهاتف، أو امسح الفلاتر.",
      }}
      isFiltered={isFiltered}
      onClearFilters={onClearFilters}
      onRowClick={(c) => actions.onStatement(c.id)}
      rowClassName={(c) => (!c.isActive ? "bg-muted/20" : undefined)}
      rowHeightClassName="h-16"
      selectable
      getRowLabel={(c) => c.name}
      bulkActions={bulkActions}
      pagination={pagination}
    />
  );
}
