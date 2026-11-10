"use client";

import {
  IconAdjustments,
  IconAlertTriangle,
  IconBox,
  IconBuildingWarehouse,
  IconClockPause,
  IconHistory,
  IconPackageOff,
  IconSearch,
} from "@tabler/icons-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import type { AppTableColumn } from "@/components/shared/AppTable/types";
import { Money } from "@/components/shared/Money";
import { OptionSelect } from "@/components/shared/OptionSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProgressBar } from "@/components/shared/motion";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatTile } from "@/components/shared/StatTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { getProducts } from "@/features/products/api/products.api";
import type { Product } from "@/features/products/types/product";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useHotkey } from "@/hooks/useHotkey";
import { formatDayLabel } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  INVENTORY_SHORTCUTS,
  STAGNANT_DAYS_OPTIONS,
  TABS,
} from "../config/inventoryOptions";
import { useStockReport } from "../hooks/useInventory";
import type { InventoryTab, StockRow } from "../types/inventory";
import { AdjustStockDialog, type AdjustTarget } from "./adjustStockDialog";
import { LedgerSheet } from "./ledgerSheet";

const PAGE_SIZES = [24, 48, 96];

const fromProduct = (p: Product): StockRow => ({
  productId: p.id,
  name: p.name,
  unit: p.unit,
  stock: p.stock,
  minStock: p.minStock,
  costPrice: p.costPrice ?? 0,
  stockValue: Math.max(p.stock, 0) * (p.costPrice ?? 0),
  lastSoldAt: null,
});

const toTarget = (r: StockRow): AdjustTarget => ({
  productId: r.productId,
  name: r.name,
  unit: r.unit,
  stock: r.stock,
});

/** المخزون: الأرصدة والنواقص والراكد + الجرد والتالف وحركة كل صنف. */
export function InventoryScreen() {
  const [tab, setTab] = useState<InventoryTab>("all");
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, 300);
  const [stagnantDays, setStagnantDays] = useState("30");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [ledgerFor, setLedgerFor] = useState<AdjustTarget | null>(null);
  const [adjustFor, setAdjustFor] = useState<AdjustTarget | null>(null);

  const report = useStockReport(Number(stagnantDays));
  const products = useQuery({
    queryKey: ["products", "inventory", tab, q, page, pageSize],
    queryFn: () =>
      getProducts({
        q: q || undefined,
        stock: tab === "low" || tab === "out" ? tab : undefined,
        sort: "stock_asc",
        page,
        page_size: pageSize,
      }),
    enabled: tab !== "stagnant",
    placeholderData: keepPreviousData,
  });

  const r = report.data;
  const stagnantRows = (r?.stagnant ?? []).filter(
    (x) => !q || x.name.includes(q),
  );
  const rows: StockRow[] =
    tab === "stagnant"
      ? stagnantRows.slice((page - 1) * pageSize, page * pageSize)
      : (products.data?.items ?? []).map(fromProduct);
  const total =
    tab === "stagnant" ? stagnantRows.length : (products.data?.total ?? 0);
  const loading = tab === "stagnant" ? report.isPending : products.isPending;

  // F4 من داخل نافذة الحركة = تعديل نفس الصنف.
  useHotkey(INVENTORY_SHORTCUTS.adjust.match, () => {
    if (ledgerFor && !adjustFor) setAdjustFor(ledgerFor);
  });

  const switchTab = (next: InventoryTab) => {
    setTab(next);
    setPage(1);
  };

  const columns: AppTableColumn<StockRow>[] = [
    {
      id: "name",
      header: "الصنف",
      skeletonClassName: "w-48",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{row.name}</p>
          {tab === "stagnant" && (
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
      cell: (row) => {
        const out = row.stock <= 0;
        const low = !out && row.minStock > 0 && row.stock <= row.minStock;
        return (
          <div className="w-32 space-y-1">
            <p className="flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  "font-mono font-semibold",
                  out && "text-destructive",
                  low && "text-warning",
                )}
              >
                {formatQty(row.stock)}
              </span>
              <span className="text-muted-foreground">{row.unit}</span>
              {out && (
                <Badge
                  variant="outline"
                  className="border-destructive/50 px-1 font-normal text-destructive"
                >
                  نفد
                </Badge>
              )}
              {low && (
                <Badge
                  variant="outline"
                  className="border-warning/50 px-1 font-normal text-warning"
                >
                  قليل
                </Badge>
              )}
            </p>
            {row.minStock > 0 && (
              <ProgressBar
                value={row.stock / (row.minStock * 2)}
                barClassName={
                  out ? "bg-destructive" : low ? "bg-warning" : "bg-success"
                }
              />
            )}
          </div>
        );
      },
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
            onClick={() => setAdjustFor(toTarget(row))}
            className="gap-1 font-normal"
          >
            <IconAdjustments className="size-3.5" />
            تعديل
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`حركة ${row.name}`}
            onClick={() => setLedgerFor(toTarget(row))}
          >
            <IconHistory />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="المخزون"
        description="تابع النواقص والراكد، وسجّل الجرد والتالف والهدايا. كل تعديل يظهر في حركة الصنف وسجل العمليات."
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile
          index={0}
          icon={<IconBuildingWarehouse />}
          label="قيمة المخزون (بسعر الشراء)"
          active={tab === "all"}
          onClick={() => switchTab("all")}
        >
          <Money amount={r?.stockValue ?? 0} className="text-lg" />
        </StatTile>
        <StatTile
          index={1}
          icon={<IconAlertTriangle />}
          label="قارب على النفاد"
          tone="warning"
          active={tab === "low"}
          onClick={() => switchTab("low")}
        >
          <span className="font-mono">{r?.low.length ?? 0}</span>
        </StatTile>
        <StatTile
          index={2}
          icon={<IconPackageOff />}
          label="نفد من المخزون"
          tone="danger"
          active={tab === "out"}
          onClick={() => switchTab("out")}
        >
          <span className="font-mono">{r?.out.length ?? 0}</span>
        </StatTile>
        <StatTile
          index={3}
          icon={<IconClockPause />}
          label={`راكد (${stagnantDays} يوماً بلا بيع)`}
          active={tab === "stagnant"}
          onClick={() => switchTab("stagnant")}
          hint={
            r ? (
              <>
                مجمّد فيه{" "}
                <Money amount={r.stagnantValue} className="text-[11px]" />
              </>
            ) : undefined
          }
        >
          <span className="font-mono">{r?.stagnant.length ?? 0}</span>
        </StatTile>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="h-10 min-w-56 flex-1">
            <InputGroupAddon>
              <IconSearch />
            </InputGroupAddon>
            <InputGroupInput
              data-page-search
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="اسم الصنف أو الباركود…  ( / )"
              aria-label="بحث في المخزون"
            />
          </InputGroup>
          {tab === "stagnant" && (
            <OptionSelect
              label="مدة الركود"
              items={STAGNANT_DAYS_OPTIONS}
              value={stagnantDays as "30"}
              onChange={setStagnantDays}
              className="w-40"
            />
          )}
        </div>
        <SegmentedTabs
          label="عرض"
          items={TABS.map((t) => ({
            ...t,
            count:
              t.id === "low"
                ? r?.low.length
                : t.id === "out"
                  ? r?.out.length
                  : t.id === "stagnant"
                    ? r?.stagnant.length
                    : undefined,
          }))}
          value={tab}
          onChange={switchTab}
        />
      </div>

      <AppTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.productId}
        onRowClick={(row) => setLedgerFor(toTarget(row))}
        isLoading={loading}
        isFetching={
          tab === "stagnant" ? report.isFetching : products.isFetching
        }
        isError={tab === "stagnant" ? report.isError : products.isError}
        errorMessage={extractErrorMessage(
          tab === "stagnant" ? report.error : products.error,
          "تعذّر تحميل المخزون",
        )}
        onRetry={() =>
          tab === "stagnant" ? report.refetch() : products.refetch()
        }
        isFiltered={q !== ""}
        onClearFilters={() => setSearch("")}
        empty={{
          icon: IconBox,
          title: tab === "all" ? "لا توجد أصناف بعد" : "لا توجد أصناف هنا",
          description:
            tab === "all"
              ? "أضف أصنافك من صفحة المنتجات."
              : "ممتاز! لا يوجد ما يحتاج انتباهك.",
        }}
        rowHeightClassName="h-16"
        pagination={{
          total,
          page,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
          pageSizes: PAGE_SIZES,
          itemsLabel: "الأصناف",
        }}
      />

      <LedgerSheet
        target={ledgerFor}
        onClose={() => setLedgerFor(null)}
        onAdjust={setAdjustFor}
      />
      <AdjustStockDialog
        target={adjustFor}
        onClose={() => {
          setAdjustFor(null);
          setLedgerFor(null);
        }}
      />
    </div>
  );
}
