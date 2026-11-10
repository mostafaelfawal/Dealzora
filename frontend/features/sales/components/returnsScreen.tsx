"use client";

import { IconReceiptRefund, IconSearch } from "@tabler/icons-react";
import { useState } from "react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import type { AppTableColumn } from "@/components/shared/AppTable/types";
import { Money } from "@/components/shared/Money";
import { OptionSelect } from "@/components/shared/OptionSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { PeriodPicker, periodOf, type PeriodValue } from "@/components/shared/PeriodPicker";
import { StatTile } from "@/components/shared/StatTile";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { round2 } from "@/features/pos/lib/posCalc";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatWhen } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { formatQty } from "@/lib/format";

import { PAGE_SIZES, RETURN_REASON_LABEL, RETURN_REASONS } from "../config/saleOptions";
import { useReturnsList } from "../hooks/useSales";
import type { ReturnReason, SaleReturn } from "../types/sale";
import { SaleDetailSheet } from "./saleDetailSheet";
import { SaleReturnDialog } from "./saleReturnDialog";
import type { Sale } from "../types/sale";

const REASON_OPTIONS = [
  { value: "all" as const, label: "كل الأسباب" },
  ...RETURN_REASONS.map((r) => ({ value: r.id, label: r.label })),
];

/** سجل المرتجعات: ماذا رجع، من أي فاتورة، ولماذا، وكيف رُدّ المبلغ. */
export function ReturnsScreen() {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, 300);
  const [period, setPeriod] = useState<PeriodValue>(periodOf("month"));
  const [reason, setReason] = useState<ReturnReason | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [openSale, setOpenSale] = useState<string | null>(null);
  const [returning, setReturning] = useState<Sale | null>(null);

  const list = useReturnsList({
    q,
    reason: reason === "all" ? undefined : reason,
    dateFrom: period.range.from,
    dateTo: period.range.to,
    page,
    pageSize,
  });
  const items = list.data?.items ?? [];
  const pageTotal = round2(items.reduce((s, r) => s + r.total, 0));
  const pageCash = round2(items.reduce((s, r) => s + r.cashRefund, 0));

  const columns: AppTableColumn<SaleReturn>[] = [
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
      cell: (r) => (
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
        </span>
      ),
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

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="المرتجعات"
        description="المرتجع يرجّع الأصناف للمخزون تلقائياً. لعمل مرتجع جديد افتح الفاتورة من صفحة الفواتير أو من الكاشير (F10)."
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <StatTile index={0} icon={<IconReceiptRefund />} label="مرتجعات الصفحة" tone="danger">
          <Money amount={pageTotal} className="text-lg" />
        </StatTile>
        <StatTile index={1} icon={<IconReceiptRefund />} label="رُدّ نقداً">
          <Money amount={pageCash} className="text-lg" />
        </StatTile>
        <StatTile index={2} icon={<IconReceiptRefund />} label="عدد المرتجعات">
          <span className="font-mono">{list.data?.total ?? 0}</span>
        </StatTile>
      </div>

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
            placeholder="رقم الفاتورة أو المرتجع أو العميل…  ( / )"
            aria-label="بحث في المرتجعات"
          />
        </InputGroup>
        <PeriodPicker value={period} onChange={(v) => { setPeriod(v); setPage(1); }} />
        <OptionSelect
          label="السبب"
          items={REASON_OPTIONS}
          value={reason}
          onChange={(v) => {
            setReason(v);
            setPage(1);
          }}
          className="w-36"
        />
      </div>

      <AppTable
        data={items}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={(r) => setOpenSale(r.saleId)}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        isError={list.isError}
        errorMessage={extractErrorMessage(list.error, "تعذّر تحميل المرتجعات")}
        onRetry={() => list.refetch()}
        isFiltered={q !== "" || reason !== "all"}
        onClearFilters={() => {
          setSearch("");
          setReason("all");
        }}
        empty={{
          icon: IconReceiptRefund,
          title: "لا توجد مرتجعات في هذه الفترة",
          description: "ممتاز! لم يرجع أي صنف.",
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
          itemsLabel: "المرتجعات",
        }}
      />

      <SaleDetailSheet saleId={openSale} onClose={() => setOpenSale(null)} onReturn={setReturning} />
      <SaleReturnDialog sale={returning} onClose={() => setReturning(null)} />
    </div>
  );
}
