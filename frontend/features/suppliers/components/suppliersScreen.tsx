"use client";

import { AppTableCardsSkeleton } from "@/components/shared/AppTable/AppTableCards";
import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { useHotkey } from "@/hooks/useHotkey";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

import { PAGE_SIZES, SUPPLIERS_SEARCH_ID } from "../config/supplierOptions";
import { SUPPLIER_ROUTES } from "../config/supplierRoutes";
import { SUPPLIERS_SHORTCUTS } from "../config/supplierShortcuts";
import { useSuppliersList } from "../hooks/useSuppliersList";
import { useSuppliersView } from "../hooks/useSuppliersView";
import type { Supplier } from "../types/supplier";
import { SupplierCard } from "./supplierCard";
import { SupplierPaymentDialog } from "./supplierPaymentDialog";
import { SuppliersEmpty } from "./suppliersEmpty";
import { SuppliersPagination } from "./suppliersPagination";
import { SuppliersStats } from "./suppliersStats";
import { SuppliersTable } from "./suppliersTable";
import { SuppliersToolbar } from "./suppliersToolbar";

/** صفحة إدارة الموردين: إحصائيات سريعة + بحث وفلاتر + بطاقات أو جدول. */
export function SuppliersScreen() {
  const router = useRouter();
  const list = useSuppliersList();
  const { view, setView } = useSuppliersView();
  const [payTarget, setPayTarget] = useState<Supplier | null>(null);

  // الاختصارات لا تعمل والنافذة مفتوحة.
  const whenIdle = (fn: () => void) => () => {
    if (!payTarget) fn();
  };

  useHotkey(
    SUPPLIERS_SHORTCUTS.focusSearch.match,
    whenIdle(() => {
      const input = document.getElementById(
        SUPPLIERS_SEARCH_ID,
      ) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }),
  );
  useHotkey(
    SUPPLIERS_SHORTCUTS.newSupplier.match,
    whenIdle(() => router.push(SUPPLIER_ROUTES.new)),
  );
  useHotkey(
    SUPPLIERS_SHORTCUTS.toggleView.match,
    whenIdle(() => setView(view === "cards" ? "table" : "cards")),
  );

  const actions = {
    onToggleActive: list.toggleActive,
    onPay: (id: string) => setPayTarget(list.find(id) ?? null),
    onRemove: list.remove,
  };

  const emptyAction = (
    <Button
      size="lg"
      nativeButton={false}
      render={<Link href={SUPPLIER_ROUTES.new} />}
      className="gap-2"
    >
      <IconPlus />
      مورد جديد
      <ShortcutBadge className="border-primary-foreground/30 text-primary-foreground/80">
        {SUPPLIERS_SHORTCUTS.newSupplier.label}
      </ShortcutBadge>
    </Button>
  );

  function renderBody() {
    // الجدول يعرض التحميل والخطأ والفراغ بنفسه.
    if (view === "table") {
      return (
        <SuppliersTable
          suppliers={list.suppliers}
          isLoading={list.isPending}
          isFetching={list.isFetching}
          isError={list.isError}
          errorMessage={extractErrorMessage(list.error, "تعذّر تحميل الموردين")}
          onRetry={() => list.refetch()}
          isFiltered={list.filtered}
          onClearFilters={list.clearFilters}
          emptyAction={emptyAction}
          pagination={{
            total: list.total,
            page: list.page,
            pageSize: list.filters.pageSize,
            onPageChange: (page) => list.patchFilters({ page }),
            onPageSizeChange: (pageSize) => list.patchFilters({ pageSize }),
            pageSizes: PAGE_SIZES,
            itemsLabel: "الموردين",
          }}
          bulkActions={{
            itemLabel: "مورد",
            isPending: list.bulkPending,
            onDelete: list.bulkRemove,
            onDeactivate: list.bulkDeactivate,
          }}
          {...actions}
        />
      );
    }

    if (list.isPending) {
      return (
        <AppTableCardsSkeleton count={Math.min(list.filters.pageSize, 8)} />
      );
    }

    if (list.isError) {
      return (
        <div className="flex flex-col items-center gap-3 border border-dashed py-16 text-center">
          <p role="alert" className="text-sm text-destructive">
            {extractErrorMessage(list.error, "تعذّر تحميل الموردين")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => list.refetch()}
          >
            إعادة المحاولة
          </Button>
        </div>
      );
    }

    if (list.suppliers.length === 0) {
      return (
        <SuppliersEmpty
          hasSuppliers={list.summary.total > 0}
          onClearFilters={list.clearFilters}
        />
      );
    }

    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.suppliers.map((supplier, index) => (
          <SupplierCard
            key={supplier.id}
            supplier={supplier}
            index={index}
            {...actions}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">الموردون</h1>
          <p className="text-xs text-muted-foreground">
            تابع حسابات مورديك ومستحقاتهم ودفعاتهم من مكان واحد.
          </p>
        </div>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={SUPPLIER_ROUTES.new} />}
          className="h-10 gap-2"
        >
          <IconPlus className="size-4" />
          مورد جديد
          <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
            {SUPPLIERS_SHORTCUTS.newSupplier.label}
          </ShortcutBadge>
        </Button>
      </header>

      <SuppliersStats
        summary={list.summary}
        balance={list.filters.balance}
        onBalanceChange={(balance) => list.patchFilters({ balance })}
      />

      <SuppliersToolbar
        filters={list.filters}
        onChange={list.patchFilters}
        view={view}
        onViewChange={setView}
      />

      <p aria-live="polite" className="text-xs text-muted-foreground">
        عرض{" "}
        <bdi dir="ltr" className="font-mono">
          {list.suppliers.length}
        </bdi>{" "}
        من{" "}
        <bdi dir="ltr" className="font-mono">
          {list.total}
        </bdi>{" "}
        مورد
        {list.filtered && (
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={list.clearFilters}
            className="font-normal"
          >
            مسح الفلاتر
          </Button>
        )}
      </p>

      <div
        aria-busy={list.isFetching}
        className={cn(
          "transition-opacity",
          list.isFetching && !list.isPending && "opacity-60",
        )}
      >
        {renderBody()}
      </div>

      {view === "cards" && list.total > 0 && (
        <SuppliersPagination
          total={list.total}
          page={list.page}
          pageSize={list.filters.pageSize}
          onPageChange={(page) => list.patchFilters({ page })}
          onPageSizeChange={(pageSize) => list.patchFilters({ pageSize })}
        />
      )}

      <SupplierPaymentDialog
        supplier={payTarget}
        onClose={() => setPayTarget(null)}
      />
    </div>
  );
}
