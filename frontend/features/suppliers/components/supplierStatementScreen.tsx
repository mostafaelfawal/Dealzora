"use client";

import {
  IconArrowRight,
  IconCash,
  IconPencil,
  IconReceipt,
} from "@tabler/icons-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import type { AppTableColumn } from "@/components/shared/AppTable/types";
import { Money } from "@/components/shared/Money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

import { PAGE_SIZES, TRANSACTION_LABELS } from "../config/supplierOptions";
import { SUPPLIER_ROUTES } from "../config/supplierRoutes";
import useGetSupplier from "../hooks/useGetSupplier";
import useGetSupplierStatement from "../hooks/useGetSupplierStatement";
import {
  BALANCE_LABEL,
  BALANCE_TONE,
  balanceStatus,
} from "../lib/supplierCalc";
import type { SupplierTransaction } from "../types/supplier";
import { SupplierPaymentDialog } from "./supplierPaymentDialog";

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

/** كشف حساب مورد: كل حركة تغيّر المستحق مع الرصيد بعدها. */
export function SupplierStatementScreen() {
  const supplierId = useSearchParams().get("supplier_id");
  const supplierQuery = useGetSupplier(supplierId);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1]);
  const [paying, setPaying] = useState(false);
  const statement = useGetSupplierStatement(supplierId, page, pageSize);
  const supplier = supplierQuery.data;

  const columns: AppTableColumn<SupplierTransaction>[] = [
    {
      id: "date",
      header: "التاريخ",
      cellClassName: "text-muted-foreground",
      cell: (t) => <span className="text-xs">{formatDate(t.createdAt)}</span>,
    },
    {
      id: "type",
      header: "العملية",
      cell: (t) => (
        <div className="min-w-0">
          <span className="block text-xs font-medium">
            {TRANSACTION_LABELS[t.type]}
          </span>
          {t.note && (
            <span className="block max-w-64 truncate text-[11px] text-muted-foreground">
              {t.note}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "amount",
      header: "المبلغ",
      cell: (t) => (
        <span
          className={cn(
            "inline-flex items-center gap-1",
            t.amount < 0 ? "text-success" : "text-warning",
          )}
        >
          <bdi dir="ltr" className="font-mono text-xs">
            {t.amount < 0 ? "−" : "+"}
          </bdi>
          <Money amount={Math.abs(t.amount)} className="text-sm" />
        </span>
      ),
    },
    {
      id: "balance",
      header: "الرصيد بعدها",
      cell: (t) => <Money amount={t.balanceAfter} className="text-sm" />,
    },
  ];

  if (!supplierId || supplierQuery.isError) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-24 text-center">
        <IconReceipt className="size-10 text-muted-foreground" />
        <p className="text-sm font-medium">لم نجد هذا المورد</p>
        <p className="text-xs text-muted-foreground">
          {extractErrorMessage(supplierQuery.error, "ربما حُذف أو الرابط غير صحيح.")}
        </p>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={SUPPLIER_ROUTES.list} />}
        >
          رجوع إلى الموردين
        </Button>
      </div>
    );
  }

  const status = balanceStatus(supplier?.balance ?? 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="رجوع إلى الموردين"
          nativeButton={false}
          render={<Link href={SUPPLIER_ROUTES.list} />}
        >
          <IconArrowRight />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">
            كشف حساب {supplier?.name ?? "…"}
          </h1>
          <p className="text-xs text-muted-foreground">
            كل ما اشتريناه وسدّدناه لهذا المورد.
          </p>
        </div>
        {supplier && (
          <>
            <Button
              type="button"
              variant="outline"
              size="lg"
              nativeButton={false}
              render={<Link href={SUPPLIER_ROUTES.edit(supplier.id)} />}
              className="h-10 gap-2 font-normal"
            >
              <IconPencil className="size-4" />
              تعديل
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={() => setPaying(true)}
              className="h-10 gap-2"
            >
              <IconCash className="size-4" />
              تسجيل دفعة
            </Button>
          </>
        )}
      </header>

      <div className="flex items-center justify-between gap-3 border bg-card p-3">
        <div className="space-y-0.5">
          <span className="block text-xs text-muted-foreground">
            الرصيد الحالي
          </span>
          <Money
            amount={Math.abs(supplier?.balance ?? 0)}
            className="text-lg font-semibold"
          />
        </div>
        <Badge
          variant="outline"
          className={cn("font-normal", BALANCE_TONE[status])}
        >
          {BALANCE_LABEL[status]}
        </Badge>
      </div>

      <AppTable
        data={statement.data?.items ?? []}
        columns={columns}
        getRowId={(t) => t.id}
        isLoading={statement.isPending}
        isFetching={statement.isFetching}
        isError={statement.isError}
        errorMessage={extractErrorMessage(statement.error, "تعذّر تحميل الكشف")}
        onRetry={() => statement.refetch()}
        empty={{
          icon: IconReceipt,
          title: "لا توجد حركات بعد",
          description: "ستظهر هنا فواتير الشراء والدفعات فور تسجيلها.",
        }}
        noResults={{ title: "لا توجد حركات" }}
        isFiltered={false}
        onClearFilters={() => {}}
        pagination={{
          total: statement.data?.total ?? 0,
          page,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
          pageSizes: PAGE_SIZES,
          itemsLabel: "الحركات",
        }}
      />

      <SupplierPaymentDialog
        supplier={paying ? (supplier ?? null) : null}
        onClose={() => setPaying(false)}
      />
    </div>
  );
}
