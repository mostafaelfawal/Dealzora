"use client";

import { IconReceiptRefund } from "@tabler/icons-react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import {
  CardBadges,
  CardFoot,
  CardHead,
} from "@/components/shared/AppTable/AppTableCards";
import type { AppTableColumn } from "@/components/shared/AppTable/types";
import { Money } from "@/components/shared/Money";
import { Badge } from "@/components/ui/badge";
import type { ViewMode } from "@/hooks/useViewMode";
import { formatWhen } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { formatQty } from "@/lib/format";

import { PAGE_SIZES, RETURN_REASON_LABEL } from "../config/saleOptions";
import type { ReturnsFilters } from "../hooks/useReturnsFilters";
import type { SaleReturn } from "../types/sale";

function RefundBadges({ ret: r }: { ret: SaleReturn }) {
  return (
    <span className="flex flex-wrap gap-1">
      {r.cashRefund > 0 && (
        <Badge variant="outline" className="font-normal">
          نقداً <Money amount={r.cashRefund} className="text-[10px]" />
        </Badge>
      )}
      {r.creditRefund > 0 && (
        <Badge variant="secondary" className="font-normal">
          من الدين <Money amount={r.creditRefund} className="text-[10px]" />
        </Badge>
      )}
      {r.walletRefund > 0 && (
        <Badge variant="outline" className="border-primary/50 font-normal">
          للمحفظة <Money amount={r.walletRefund} className="text-[10px]" />
        </Badge>
      )}
    </span>
  );
}

const COLUMNS: AppTableColumn<SaleReturn>[] = [
  {
    id: "ret",
    header: "المرتجع",
    skeletonClassName: "w-40",
    cell: (r) => (
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs">
          <span className="font-mono font-semibold">مرتجع #{r.number}</span>
          <span className="text-muted-foreground">من فاتورة</span>
          <span className="font-mono">#{r.saleNumber}</span>
        </p>
        <p className="mt-0.5 max-w-72 truncate text-[11px] text-muted-foreground">
          {r.lines.map((l) => `${l.name} (${formatQty(l.qty)})`).join("، ")}
        </p>
      </div>
    ),
  },
  {
    id: "total",
    header: "القيمة",
    cell: (r) => <Money amount={r.total} className="text-sm" />,
  },
  {
    id: "refund",
    header: "طريقة الرد",
    className: "hidden md:table-cell",
    cell: (r) => <RefundBadges ret={r} />,
  },
  {
    id: "reason",
    header: "السبب",
    className: "hidden sm:table-cell",
    cellClassName: "text-xs",
    cell: (r) => RETURN_REASON_LABEL[r.reason],
  },
  {
    id: "when",
    header: "التاريخ",
    className: "hidden lg:table-cell",
    cellClassName: "text-xs text-muted-foreground",
    cell: (r) => `${formatWhen(r.returnedAt)} · ${r.cashierName ?? "—"}`,
  },
];

/** بطاقة مرتجع: القيمة والسبب، ثم الأصناف الراجعة وطريقة الرد. */
function ReturnCard({ ret: r }: { ret: SaleReturn }) {
  return (
    <>
      <CardHead
        title={
          <span className="font-mono text-sm font-semibold">
            مرتجع #{r.number}
          </span>
        }
        subtitle={
          <>
            من فاتورة <span className="font-mono">#{r.saleNumber}</span>
            {r.customerName && ` · ${r.customerName}`}
          </>
        }
        aside={
          <Money
            amount={r.total}
            className="text-base font-semibold text-destructive"
          />
        }
      />
      <CardBadges>
        <Badge variant="outline" className="font-normal text-muted-foreground">
          {RETURN_REASON_LABEL[r.reason]}
        </Badge>
      </CardBadges>
      <ul className="mt-auto space-y-1 border-t border-border/60 pt-2.5 text-xs">
        {r.lines.slice(0, 3).map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">{l.name}</span>
            <span className="shrink-0 font-mono text-muted-foreground">
              {formatQty(l.qty)} {l.unitName}
            </span>
          </li>
        ))}
        {r.lines.length > 3 && (
          <li className="text-[11px] text-muted-foreground">
            +{r.lines.length - 3} أصناف أخرى
          </li>
        )}
      </ul>
      <RefundBadges ret={r} />
      <CardFoot>
        <span>{formatWhen(r.returnedAt)}</span>
        {r.cashierName && <span className="truncate">{r.cashierName}</span>}
      </CardFoot>
    </>
  );
}

export function ReturnsTable({
  filters: f,
  onOpenSale,
  view,
}: {
  filters: ReturnsFilters;
  onOpenSale: (saleId: string) => void;
  view: ViewMode;
}) {
  const { list } = f;
  return (
    <AppTable
      data={f.items}
      columns={COLUMNS}
      getRowId={(r) => r.id}
      onRowClick={(r) => onOpenSale(r.saleId)}
      isLoading={list.isPending}
      isFetching={list.isFetching}
      isError={list.isError}
      errorMessage={extractErrorMessage(list.error, "تعذّر تحميل المرتجعات")}
      onRetry={() => list.refetch()}
      isFiltered={f.isFiltered}
      onClearFilters={f.clearFilters}
      empty={{
        icon: IconReceiptRefund,
        title: "لا توجد مرتجعات في هذه الفترة",
        description: "ممتاز! لم يُرجَع أي صنف.",
      }}
      rowHeightClassName="h-16"
      view={view}
      renderCard={(r) => <ReturnCard ret={r} />}
      getCardLabel={(r) => `مرتجع رقم ${r.number} من فاتورة ${r.saleNumber}`}
      pagination={{
        total: f.totals.count,
        page: f.page,
        pageSize: f.pageSize,
        onPageChange: f.setPage,
        onPageSizeChange: f.setPageSize,
        pageSizes: [...PAGE_SIZES],
        itemsLabel: "المرتجعات",
      }}
    />
  );
}
