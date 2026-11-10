"use client";

import {
  IconCalendarMonth,
  IconCalendarWeek,
  IconCoin,
  IconReceipt,
  IconSearch,
  IconShoppingCartPlus,
} from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import type { AppTableColumn } from "@/components/shared/AppTable/types";
import { Money } from "@/components/shared/Money";
import { OptionSelect } from "@/components/shared/OptionSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  PeriodPicker,
  periodOf,
  type PeriodValue,
} from "@/components/shared/PeriodPicker";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { StatTile } from "@/components/shared/StatTile";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { SHORTCUTS } from "@/config/shortcuts";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatWhen } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

import {
  DEFAULT_PAGE_SIZE,
  METHOD_OPTIONS,
  PAGE_SIZES,
  SORT_OPTIONS,
  STATUS_TABS,
} from "../config/saleOptions";
import { useSalesList, useSalesSummary } from "../hooks/useSales";
import type {
  PaymentMethod,
  Sale,
  SaleSort,
  SaleStatusFilter,
} from "../types/sale";
import { SaleBadges } from "./saleBadges";
import { SaleDetailSheet } from "./saleDetailSheet";
import { SaleReturnDialog } from "./saleReturnDialog";

const initialOpen = () =>
  typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search).get("open");

/** سجل الفواتير: بحث برقم الفاتورة أو العميل، فلترة بالفترة وطريقة الدفع، وتفاصيل كل فاتورة. */
export function SalesScreen() {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, 300);
  const [period, setPeriod] = useState<PeriodValue>(periodOf("today"));
  const [method, setMethod] = useState<PaymentMethod | "all">("all");
  const [status, setStatus] = useState<SaleStatusFilter>("all");
  const [sort, setSort] = useState<SaleSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(initialOpen);
  const [returning, setReturning] = useState<Sale | null>(null);

  // البحث برقم الفاتورة يتجاهل الفترة (الرقم فريد).
  const byNumber = /^#?\d+$/.test(q.trim());
  const filters = {
    q,
    method,
    status,
    sort,
    dateFrom: byNumber ? undefined : period.range.from,
    dateTo: byNumber ? undefined : period.range.to,
    page,
    pageSize,
  };
  const list = useSalesList(filters);
  const summary = useSalesSummary();
  const s = summary.data;

  const reset =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };
  const filtered = q !== "" || method !== "all" || status !== "all";

  const columns: AppTableColumn<Sale>[] = [
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
      cell: (sale) =>
        sale.profit === null ? (
          "—"
        ) : (
          <Money
            amount={sale.profit}
            className={cn(
              "text-xs",
              sale.profit < 0 ? "text-destructive" : "text-success",
            )}
          />
        ),
    },
    {
      id: "cashier",
      header: "الكاشير",
      className: "hidden lg:table-cell",
      cellClassName: "text-xs text-muted-foreground",
      cell: (sale) => sale.cashierName ?? "—",
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="الفواتير"
        description="كل فواتير البيع. اضغط على أي فاتورة لطباعتها أو إرسالها واتساب أو عمل مرتجع منها."
        actions={
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/pos" />}
            className="h-10 gap-2"
          >
            <IconShoppingCartPlus className="size-4" />
            بيع جديد
            <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
              {SHORTCUTS.newSale.label}
            </ShortcutBadge>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile
          index={0}
          icon={<IconReceipt />}
          label="صافي مبيعات اليوم"
          active={period.preset === "today"}
          onClick={() => reset(setPeriod)(periodOf("today"))}
          hint={s ? `${s.todayCount} فاتورة` : undefined}
        >
          <Money amount={s?.todayTotal ?? 0} className="text-lg" />
        </StatTile>
        <StatTile
          index={1}
          icon={<IconCoin />}
          label="ربح اليوم"
          tone="success"
          hint={s && s.todayReturns > 0 ? `مرتجع ${s.todayReturns}` : undefined}
        >
          <Money amount={s?.todayProfit ?? 0} className="text-lg" />
        </StatTile>
        <StatTile
          index={2}
          icon={<IconCalendarWeek />}
          label="آخر 7 أيام"
          active={period.preset === "week"}
          onClick={() => reset(setPeriod)(periodOf("week"))}
        >
          <Money amount={s?.weekTotal ?? 0} className="text-lg" />
        </StatTile>
        <StatTile
          index={3}
          icon={<IconCalendarMonth />}
          label="هذا الشهر"
          active={period.preset === "month"}
          onClick={() => reset(setPeriod)(periodOf("month"))}
          hint={s ? `ربح ${s.monthProfit.toLocaleString("en-US")}` : undefined}
        >
          <Money amount={s?.monthTotal ?? 0} className="text-lg" />
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
              placeholder="رقم الفاتورة أو اسم/هاتف العميل…  ( / )"
              aria-label="بحث في الفواتير"
            />
          </InputGroup>
          <PeriodPicker value={period} onChange={reset(setPeriod)} />
          <OptionSelect
            label="طريقة الدفع"
            items={METHOD_OPTIONS}
            value={method}
            onChange={reset(setMethod)}
            className="w-36"
          />
          <OptionSelect
            label="الترتيب"
            items={SORT_OPTIONS}
            value={sort}
            onChange={reset(setSort)}
            className="w-36"
          />
        </div>
        <SegmentedTabs
          label="حالة الفاتورة"
          items={STATUS_TABS}
          value={status}
          onChange={reset(setStatus)}
        />
      </div>

      <AppTable
        data={list.data?.items ?? []}
        columns={columns}
        getRowId={(sale) => sale.id}
        onRowClick={(sale) => setOpenId(sale.id)}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        isError={list.isError}
        errorMessage={extractErrorMessage(list.error, "تعذّر تحميل الفواتير")}
        onRetry={() => list.refetch()}
        isFiltered={filtered}
        onClearFilters={() => {
          setSearch("");
          setMethod("all");
          setStatus("all");
          setPage(1);
        }}
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
        pagination={{
          total: list.data?.total ?? 0,
          page,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
          pageSizes: [...PAGE_SIZES],
          itemsLabel: "الفواتير",
        }}
      />

      <SaleDetailSheet
        saleId={openId}
        onClose={() => setOpenId(null)}
        onReturn={(sale) => setReturning(sale)}
      />
      <SaleReturnDialog sale={returning} onClose={() => setReturning(null)} />
    </div>
  );
}
