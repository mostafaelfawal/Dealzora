"use client";

import { IconAdjustments, IconBox, IconHistory } from "@tabler/icons-react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import {
  CardHead,
  CardStats,
} from "@/components/shared/AppTable/AppTableCards";
import type { AppTableColumn } from "@/components/shared/AppTable/types";
import { Money } from "@/components/shared/Money";
import { ProgressBar } from "@/components/shared/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ViewMode } from "@/hooks/useViewMode";
import { formatDayLabel } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import { INVENTORY_PAGE_SIZES } from "../config/inventoryOptions";
import type { InventoryList } from "../hooks/useInventoryList";
import { stockLevel, type StockLevel } from "../lib/inventoryRows";
import type { StockRow } from "../types/inventory";

const LEVEL_STYLE: Record<
  Exclude<StockLevel, "ok">,
  { text: string; badge: string; label: string }
> = {
  out: {
    text: "text-destructive",
    badge: "border-destructive/50 text-destructive",
    label: "نفد",
  },
  low: {
    text: "text-warning",
    badge: "border-warning/50 text-warning",
    label: "قليل",
  },
};

const BAR_CLASS: Record<StockLevel, string> = {
  out: "bg-destructive",
  low: "bg-warning",
  ok: "bg-success",
};

/** الرصيد + شارة الحالة + شريط مقارنة بالحد الأدنى. */
function StockCell({ row }: { row: StockRow }) {
  const level = stockLevel(row);
  const style = level === "ok" ? null : LEVEL_STYLE[level];

  return (
    <div className="w-32 space-y-1">
      <p className="flex items-center gap-1.5 text-xs">
        <span className={cn("font-mono font-semibold", style?.text)}>
          {formatQty(row.stock)}
        </span>
        <span className="text-muted-foreground">{row.unit}</span>
        {style && (
          <Badge
            variant="outline"
            className={cn("px-1 font-normal", style.badge)}
          >
            {style.label}
          </Badge>
        )}
      </p>
      {row.minStock > 0 && (
        <ProgressBar
          value={row.stock / (row.minStock * 2)}
          barClassName={BAR_CLASS[level]}
        />
      )}
    </div>
  );
}

function buildColumns({
  showLastSold,
  onAdjust,
  onLedger,
}: {
  showLastSold: boolean;
  onAdjust: (row: StockRow) => void;
  onLedger: (row: StockRow) => void;
}): AppTableColumn<StockRow>[] {
  return [
    {
      id: "name",
      header: "الصنف",
      skeletonClassName: "w-48",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{row.name}</p>
          {showLastSold && (
            <p className="text-[11px] text-muted-foreground">
              {row.lastSoldAt
                ? `آخر بيع ${formatDayLabel(row.lastSoldAt)}`
                : "لم يُبع أبداً"}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "stock",
      header: "الرصيد",
      cell: (row) => <StockCell row={row} />,
    },
    {
      id: "min",
      header: "الحد الأدنى",
      className: "hidden md:table-cell",
      cellClassName: "font-mono text-xs text-muted-foreground",
      cell: (row) => (row.minStock > 0 ? formatQty(row.minStock) : "—"),
    },
    {
      id: "value",
      header: "قيمة المخزون",
      className: "hidden sm:table-cell",
      cell: (row) => <Money amount={row.stockValue} className="text-xs" />,
    },
    {
      id: "actions",
      header: <span className="sr-only">إجراءات</span>,
      className: "w-40",
      cell: (row) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAdjust(row)}
            className="gap-1 font-normal"
          >
            <IconAdjustments className="size-3.5" />
            تعديل
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`حركة ${row.name}`}
            onClick={() => onLedger(row)}
          >
            <IconHistory />
          </Button>
        </div>
      ),
    },
  ];
}

/** بطاقة صنف في المخزون: الرصيد بخط كبير وشريط الحد الأدنى، ثم القيمة والإجراءات. */
function StockCard({
  row,
  showLastSold,
  onAdjust,
  onLedger,
}: {
  row: StockRow;
  showLastSold: boolean;
  onAdjust: (row: StockRow) => void;
  onLedger: (row: StockRow) => void;
}) {
  const level = stockLevel(row);
  const style = level === "ok" ? null : LEVEL_STYLE[level];

  return (
    <>
      <CardHead
        title={<span className="line-clamp-2">{row.name}</span>}
        subtitle={
          showLastSold
            ? row.lastSoldAt
              ? `آخر بيع ${formatDayLabel(row.lastSoldAt)}`
              : "لم يُبع أبداً"
            : undefined
        }
        aside={
          style && (
            <Badge variant="outline" className={cn("font-normal", style.badge)}>
              {style.label}
            </Badge>
          )
        }
      />
      <div className="space-y-1.5">
        <p className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "font-mono text-xl font-semibold tabular-nums",
              style?.text,
            )}
          >
            {formatQty(row.stock)}
          </span>
          <span className="text-xs text-muted-foreground">{row.unit}</span>
        </p>
        {row.minStock > 0 && (
          <ProgressBar
            value={row.stock / (row.minStock * 2)}
            className="h-0.5"
            barClassName={BAR_CLASS[level]}
          />
        )}
      </div>
      <CardStats
        items={[
          {
            label: "الحد الأدنى",
            value: (
              <span className="font-mono">
                {row.minStock > 0 ? formatQty(row.minStock) : "—"}
              </span>
            ),
          },
          {
            label: "قيمة المخزون",
            value: <Money amount={row.stockValue} className="text-xs" />,
          },
        ]}
      />
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAdjust(row)}
          className="flex-1 gap-1 font-normal"
        >
          <IconAdjustments className="size-3.5" />
          تعديل الرصيد
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onLedger(row)}
          className="gap-1 font-normal"
        >
          <IconHistory className="size-3.5" />
          الحركة
        </Button>
      </div>
    </>
  );
}

export function InventoryTable({
  list,
  onAdjust,
  onLedger,
  view,
}: {
  list: InventoryList;
  onAdjust: (row: StockRow) => void;
  onLedger: (row: StockRow) => void;
  view: ViewMode;
}) {
  const showLastSold = list.tab === "stagnant";
  const isAll = list.tab === "all";
  return (
    <AppTable
      data={list.rows}
      columns={buildColumns({
        showLastSold,
        onAdjust,
        onLedger,
      })}
      getRowId={(row) => row.productId}
      onRowClick={onLedger}
      isLoading={list.isLoading}
      isFetching={list.isFetching}
      isError={list.isError}
      errorMessage={extractErrorMessage(list.error, "تعذّر تحميل المخزون")}
      onRetry={list.refetch}
      isFiltered={list.isFiltered}
      onClearFilters={list.clearSearch}
      empty={{
        icon: IconBox,
        title: isAll ? "لا توجد أصناف بعد" : "لا توجد أصناف هنا",
        description: isAll
          ? "أضف أصنافك من صفحة المنتجات."
          : "ممتاز! لا يوجد ما يحتاج انتباهك.",
      }}
      rowHeightClassName="h-16"
      view={view}
      renderCard={(row) => (
        <StockCard
          row={row}
          showLastSold={showLastSold}
          onAdjust={onAdjust}
          onLedger={onLedger}
        />
      )}
      getCardLabel={(row) => `حركة ${row.name}`}
      pagination={{
        total: list.total,
        page: list.page,
        pageSize: list.pageSize,
        onPageChange: list.setPage,
        onPageSizeChange: list.setPageSize,
        pageSizes: INVENTORY_PAGE_SIZES,
        itemsLabel: "الأصناف",
      }}
    />
  );
}
