"use client";

import { IconReceipt } from "@tabler/icons-react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import {
  CardBadges,
  CardFoot,
  CardHead,
  CardStats,
} from "@/components/shared/AppTable/AppTableCards";
import type { AppTableColumn } from "@/components/shared/AppTable/types";
import { Money } from "@/components/shared/Money";
import type { ViewMode } from "@/hooks/useViewMode";
import { formatWhen } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

import { PAGE_SIZES } from "../config/saleOptions";
import type { SalesFilters } from "../hooks/useSalesFilters";
import type { Sale } from "../types/sale";
import { SaleBadges } from "./saleBadges";

const COLUMNS: AppTableColumn<Sale>[] = [
  {
    id: "number",
    header: "الفاتورة",
    skeletonClassName: "w-32",
    cell: (sale) => (
      <div className="min-w-0">
        <p className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold">
            #{sale.number}
          </span>
          <span className="truncate text-xs">
            {sale.customerName ?? "عميل نقدي"}
          </span>
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {sale.lines.length} صنف · {formatWhen(sale.soldAt)}
        </p>
      </div>
    ),
  },
  {
    id: "total",
    header: "الإجمالي",
    cell: (sale) => (
      <div>
        <Money amount={sale.total} className="text-sm" />
        {sale.creditAmount > 0 && (
          <p className="text-[11px] text-warning">
            آجل <Money amount={sale.creditAmount} className="text-[11px]" />
          </p>
        )}
      </div>
    ),
  },
  {
    id: "status",
    header: "الدفع",
    className: "hidden sm:table-cell",
    cell: (sale) => (
      <span className="flex flex-wrap gap-1">
        <SaleBadges sale={sale} />
      </span>
    ),
  },
  {
    id: "profit",
    header: "الربح",
    className: "hidden md:table-cell",
    cell: (sale) => <Profit value={sale.profit} />,
  },
  {
    id: "cashier",
    header: "الكاشير",
    className: "hidden lg:table-cell",
    cellClassName: "text-xs text-muted-foreground",
    cell: (sale) => sale.cashierName ?? "—",
  },
];

function Profit({ value }: { value: number | null }) {
  if (value === null) return <>—</>;
  return (
    <Money
      amount={value}
      className={cn("text-xs", value < 0 ? "text-destructive" : "text-success")}
    />
  );
}

/** بطاقة فاتورة: الرقم والعميل والإجمالي أولاً، ثم الدفع والربح والوقت. */
function SaleCard({ sale }: { sale: Sale }) {
  return (
    <>
      <CardHead
        title={
          <span className="font-mono text-sm font-semibold">
            فاتورة #{sale.number}
          </span>
        }
        subtitle={sale.customerName ?? "عميل نقدي"}
        aside={<Money amount={sale.total} className="text-base font-semibold" />}
      />
      <CardBadges>
        <SaleBadges sale={sale} />
      </CardBadges>
      <CardStats
        items={[
          { label: "الأصناف", value: `${sale.lines.length} صنف` },
          {
            label: "الربح",
            value: <Profit value={sale.profit} />,
            hidden: sale.profit === null,
          },
          {
            label: "آجل على العميل",
            value: (
              <Money amount={sale.creditAmount} className="text-xs text-warning" />
            ),
            hidden: sale.creditAmount <= 0,
          },
          {
            label: "مرتجع",
            value: (
              <Money
                amount={sale.returnedTotal}
                className="text-xs text-destructive"
              />
            ),
            hidden: sale.returnedTotal <= 0,
          },
        ]}
      />
      <CardFoot>
        <span>{formatWhen(sale.soldAt)}</span>
        {sale.cashierName && <span className="truncate">{sale.cashierName}</span>}
      </CardFoot>
    </>
  );
}

export function SalesTable({
  filters: f,
  onOpen,
  view,
}: {
  filters: SalesFilters;
  onOpen: (id: string) => void;
  view: ViewMode;
}) {
  const { list } = f;
  return (
    <AppTable
      data={list.data?.items ?? []}
      columns={COLUMNS}
      getRowId={(sale) => sale.id}
      onRowClick={(sale) => onOpen(sale.id)}
      isLoading={list.isPending}
      isFetching={list.isFetching}
      isError={list.isError}
      errorMessage={extractErrorMessage(list.error, "تعذّر تحميل الفواتير")}
      onRetry={() => list.refetch()}
      isFiltered={f.isFiltered}
      onClearFilters={f.clearFilters}
      empty={{
        icon: IconReceipt,
        title: "لا توجد فواتير في هذه الفترة",
        description: "اختر فترة أخرى، أو ابدأ البيع من شاشة الكاشير.",
      }}
      noResults={{
        title: "لا توجد فواتير مطابقة",
        description: "جرّب رقماً أو اسماً آخر.",
      }}
      rowHeightClassName="h-16"
      view={view}
      renderCard={(sale) => <SaleCard sale={sale} />}
      getCardLabel={(sale) => `فاتورة رقم ${sale.number}`}
      pagination={{
        total: list.data?.total ?? 0,
        page: f.page,
        pageSize: f.pageSize,
        onPageChange: f.setPage,
        onPageSizeChange: f.setPageSize,
        pageSizes: [...PAGE_SIZES],
        itemsLabel: "الفواتير",
      }}
    />
  );
}
