"use client";

import {
  IconCalendarMonth,
  IconCash,
  IconPlus,
  IconReceiptRefund,
  IconSearch,
  IconTruckDelivery,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import type { AppTableColumn } from "@/components/shared/AppTable/types";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { PeriodPicker, periodOf, type PeriodValue } from "@/components/shared/PeriodPicker";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { StatTile } from "@/components/shared/StatTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useHotkey } from "@/hooks/useHotkey";
import { formatDayLabel, parseIsoDay } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { plain } from "@/lib/shortcuts";

import { usePurchasesList, usePurchasesSummary } from "../hooks/usePurchases";
import type { Purchase, PurchaseStatusFilter } from "../types/purchase";
import { PurchaseDetailSheet } from "./purchaseDetailSheet";

const NEW_KEY = { label: "F4", match: plain("F4") };
const STATUS_TABS: { id: PurchaseStatusFilter; label: string }[] = [
  { id: "all", label: "كل الفواتير" },
  { id: "credit", label: "فيها آجل" },
  { id: "returned", label: "عليها مرتجع" },
];

export function PurchasesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, 300);
  const [period, setPeriod] = useState<PeriodValue>(periodOf("month"));
  const [status, setStatus] = useState<PurchaseStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [openId, setOpenId] = useState<string | null>(null);

  const byNumber = /^#?\d+$/.test(q.trim());
  const list = usePurchasesList({
    q,
    status,
    dateFrom: byNumber ? undefined : period.range.from,
    dateTo: byNumber ? undefined : period.range.to,
    page,
    pageSize,
  });
  const summary = usePurchasesSummary().data;

  useHotkey(NEW_KEY.match, () => openId === null && router.push("/admin/purchases/new"));

  const columns: AppTableColumn<Purchase>[] = [
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
    { id: "total", header: "الإجمالي", cell: (p) => <Money amount={p.total} className="text-sm" /> },
    {
      id: "paid",
      header: "الدفع",
      className: "hidden sm:table-cell",
      cell: (p) =>
        p.creditAmount > 0 ? (
          <Badge variant="outline" className="border-warning/50 font-normal text-warning">
            آجل <Money amount={p.creditAmount} className="text-[10px]" />
          </Badge>
        ) : (
          <Badge variant="outline" className="border-success/50 font-normal text-success">
            مدفوعة
          </Badge>
        ),
    },
    {
      id: "returned",
      header: "مرتجع",
      className: "hidden md:table-cell",
      cell: (p) => (p.returnedTotal > 0 ? <Money amount={p.returnedTotal} className="text-xs text-destructive" /> : "—"),
    },
    {
      id: "by",
      header: "بواسطة",
      className: "hidden lg:table-cell",
      cellClassName: "text-xs text-muted-foreground",
      cell: (p) => p.createdByName ?? "—",
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="المشتريات"
        description="فواتير الشراء من الموردين. كل فاتورة تزيد المخزون وتحدّث سعر الشراء تلقائياً."
        actions={
          <Button size="lg" nativeButton={false} render={<Link href="/admin/purchases/new" />} className="h-10 gap-2">
            <IconPlus className="size-4" />
            فاتورة شراء
            <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
              {NEW_KEY.label}
            </ShortcutBadge>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile index={0} icon={<IconCalendarMonth />} label="مشتريات الشهر" hint={summary ? `${summary.monthCount} فاتورة` : undefined}>
          <Money amount={summary?.monthTotal ?? 0} className="text-lg" />
        </StatTile>
        <StatTile index={1} icon={<IconCash />} label="مدفوع هذا الشهر">
          <Money amount={summary?.monthPaid ?? 0} className="text-lg" />
        </StatTile>
        <StatTile index={2} icon={<IconTruckDelivery />} label="آجل هذا الشهر" tone="warning" onClick={() => { setStatus("credit"); setPage(1); }} active={status === "credit"}>
          <Money amount={Math.max((summary?.monthTotal ?? 0) - (summary?.monthPaid ?? 0), 0)} className="text-lg" />
        </StatTile>
        <StatTile index={3} icon={<IconReceiptRefund />} label="مرتجع للموردين" onClick={() => { setStatus("returned"); setPage(1); }} active={status === "returned"}>
          <Money amount={summary?.returnsMonth ?? 0} className="text-lg" />
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
              placeholder="رقم الفاتورة أو اسم المورد…  ( / )"
              aria-label="بحث في المشتريات"
            />
          </InputGroup>
          <PeriodPicker value={period} onChange={(v) => { setPeriod(v); setPage(1); }} />
        </div>
        <SegmentedTabs label="حالة الفاتورة" items={STATUS_TABS} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
      </div>

      <AppTable
        data={list.data?.items ?? []}
        columns={columns}
        getRowId={(p) => p.id}
        onRowClick={(p) => setOpenId(p.id)}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        isError={list.isError}
        errorMessage={extractErrorMessage(list.error, "تعذّر تحميل المشتريات")}
        onRetry={() => list.refetch()}
        isFiltered={q !== "" || status !== "all"}
        onClearFilters={() => {
          setSearch("");
          setStatus("all");
        }}
        empty={{
          icon: IconTruckDelivery,
          title: "لا توجد فواتير شراء في هذه الفترة",
          description: "سجّل أول فاتورة شراء ليدخل المخزون ويتحدث سعر الشراء.",
          action: (
            <Button size="lg" nativeButton={false} render={<Link href="/admin/purchases/new" />} className="gap-2">
              <IconPlus className="size-4" />
              فاتورة شراء جديدة
            </Button>
          ),
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
          pageSizes: [12, 24, 48],
          itemsLabel: "الفواتير",
        }}
      />

      <PurchaseDetailSheet purchaseId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
