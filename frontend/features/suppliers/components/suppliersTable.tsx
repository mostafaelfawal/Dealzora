"use client";

import { IconBuildingStore, IconPhone } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import type {
  AppTableBulkActions,
  AppTableColumn,
  AppTablePaginationProps,
} from "@/components/shared/AppTable/types";
import { Money } from "@/components/shared/Money";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { SUPPLIER_ROUTES } from "../config/supplierRoutes";
import {
  BALANCE_LABEL,
  BALANCE_TONE,
  balanceStatus,
} from "../lib/supplierCalc";
import type { Supplier } from "../types/supplier";
import {
  SupplierActionsMenu,
  type SupplierActions,
} from "./supplierActionsMenu";

interface Props extends SupplierActions {
  suppliers: Supplier[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  isFiltered: boolean;
  onClearFilters: () => void;
  emptyAction: React.ReactNode;
  pagination: AppTablePaginationProps;
  bulkActions: AppTableBulkActions<Supplier>;
}

export function SuppliersTable({
  suppliers,
  isFiltered,
  onClearFilters,
  emptyAction,
  pagination,
  bulkActions,
  onRetry,
  errorMessage,
  isLoading,
  isFetching,
  isError,
  ...actions
}: Props) {
  const router = useRouter();

  const columns: AppTableColumn<Supplier>[] = [
    {
      id: "name",
      header: "المورد",
      skeletonClassName: "w-40",
      cell: (s) => (
        <div className={cn("min-w-0", !s.isActive && "opacity-60")}>
          <span className="block max-w-64 truncate text-xs font-medium">
            {s.name}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <IconPhone className="size-3.5" aria-hidden />
            <span dir="ltr" className="font-mono">
              {s.phone || "بدون هاتف"}
            </span>
          </span>
        </div>
      ),
    },
    {
      id: "address",
      header: "العنوان",
      className: "hidden md:table-cell",
      cellClassName: "text-muted-foreground",
      cell: (s) => (
        <span className="block max-w-56 truncate">{s.address || "—"}</span>
      ),
    },
    {
      id: "balance",
      header: "الحساب",
      cell: (s) => {
        const status = balanceStatus(s.balance);
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Money amount={Math.abs(s.balance)} className="text-sm" />
            <Badge
              variant="outline"
              className={cn("font-normal", BALANCE_TONE[status])}
            >
              {BALANCE_LABEL[status]}
            </Badge>
          </div>
        );
      },
    },
    {
      id: "active",
      header: "مفعّل",
      className: "w-20",
      cell: (s) => (
        <Switch
          size="sm"
          checked={s.isActive}
          onCheckedChange={() => actions.onToggleActive(s.id)}
          aria-label={`${s.isActive ? "تعطيل" : "تفعيل"} ${s.name}`}
        />
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">إجراءات</span>,
      className: "w-12 pe-2",
      cell: (s) => <SupplierActionsMenu supplier={s} {...actions} />,
    },
  ];

  return (
    <AppTable
      data={suppliers}
      columns={columns}
      getRowId={(s) => s.id}
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      errorMessage={errorMessage}
      onRetry={onRetry}
      empty={{
        icon: IconBuildingStore,
        title: "لا يوجد موردون بعد",
        description: "أضف أول مورد لتسجّل مشترياتك ومدفوعاتك وتتابع حسابه.",
        action: emptyAction,
      }}
      noResults={{ title: "لا يوجد موردون مطابقون" }}
      isFiltered={isFiltered}
      onClearFilters={onClearFilters}
      onRowClick={(s) => router.push(SUPPLIER_ROUTES.edit(s.id))}
      rowClassName={(s) => (!s.isActive ? "bg-muted/20" : undefined)}
      selectable
      getRowLabel={(s) => s.name}
      bulkActions={bulkActions}
      pagination={pagination}
    />
  );
}
