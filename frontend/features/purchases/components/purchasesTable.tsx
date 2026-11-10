"use client";

import { IconTruckDelivery } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import type { AppTableColumn } from "@/components/shared/AppTable/types";
import { Money } from "@/components/shared/Money";
import { Badge } from "@/components/ui/badge";
import { formatDayLabel, parseIsoDay } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";

import { PURCHASE_PAGE_SIZES } from "../config/purchaseOptions";
import type { usePurchasesFilters } from "../hooks/usePurchasesFilters";
import type { Purchase } from "../types/purchase";

function PaymentBadge({ purchase: p }: { purchase: Purchase }) {
  if (p.creditAmount > 0) {
    return (
      <Badge
        variant="outline"
        className="border-warning/50 font-normal text-warning"
      >
        آجل <Money amount={p.creditAmount} className="text-[10px]" />
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-success/50 font-normal text-success"
    >
      مدفوعة
    </Badge>
  );
}

const COLUMNS: AppTableColumn<Purchase>[] = [
  {
    id: "number",
    header: "الفاتورة",
    skeletonClassName: "w-40",
    cell: (p) => (
      <div className="min-w-0">
        <p className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold">#{p.number}</span>
          <span className="truncate text-xs">{p.supplierName}</span>
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {p.lines.length} صنف · {formatDayLabel(parseIsoDay(p.purchasedOn))}
          {p.supplierInvoice && ` · مورد ${p.supplierInvoice}`}
        </p>
      </div>
    ),
  },
  {
    id: "total",
    header: "الإجمالي",
    cell: (p) => <Money amount={p.total} className="text-sm" />,
  },
  {
    id: "paid",
    header: "الدفع",
    className: "hidden sm:table-cell",
    cell: (p) => <PaymentBadge purchase={p} />,
  },
  {
    id: "returned",
    header: "مرتجع",
    className: "hidden md:table-cell",
    cell: (p) =>
      p.returnedTotal > 0 ? (
        <Money amount={p.returnedTotal} className="text-xs text-destructive" />
      ) : (
        "—"
      ),
  },
  {
    id: "by",
    header: "بواسطة",
    className: "hidden lg:table-cell",
    cellClassName: "text-xs text-muted-foreground",
    cell: (p) => p.createdByName ?? "—",
  },
];

export function PurchasesTable({
  filters: f,
  onOpen,
  emptyAction,
}: {
  filters: ReturnType<typeof usePurchasesFilters>;
  onOpen: (id: string) => void;
  emptyAction: ReactNode;
}) {
  const { list } = f;
  return (
    <AppTable
      data={list.data?.items ?? []}
      columns={COLUMNS}
      getRowId={(p) => p.id}
      onRowClick={(p) => onOpen(p.id)}
      isLoading={list.isPending}
      isFetching={list.isFetching}
      isError={list.isError}
      errorMessage={extractErrorMessage(list.error, "تعذّر تحميل المشتريات")}
      onRetry={() => list.refetch()}
      isFiltered={f.isFiltered}
      onClearFilters={f.clearFilters}
      empty={{
        icon: IconTruckDelivery,
        title: "لا توجد فواتير شراء في هذه الفترة",
        description: "سجّل أول فاتورة شراء ليدخل المخزون ويتحدث سعر الشراء.",
        action: emptyAction,
      }}
      rowHeightClassName="h-16"
      pagination={{
        total: list.data?.total ?? 0,
        page: f.page,
        pageSize: f.pageSize,
        onPageChange: f.setPage,
        onPageSizeChange: f.setPageSize,
        pageSizes: PURCHASE_PAGE_SIZES,
        itemsLabel: "الفواتير",
      }}
    />
  );
}
