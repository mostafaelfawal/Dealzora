"use client";

import { IconDownload, IconFileSpreadsheet, IconLoader2, IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { useHotkey } from "@/hooks/useHotkey";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

import { PRODUCT_ROUTES } from "../config/productRoutes";
import { PRODUCTS_SHORTCUTS } from "../config/productShortcuts";
import { useProductsList } from "../hooks/useProductsList";
import { useProductsView } from "../hooks/useProductsView";
import { ImportExcelDialog } from "./importExcelDialog";
import { ProductCard } from "./productCard";
import { ProductsEmpty } from "./productsEmpty";
import { ProductsPagination } from "./productsPagination";
import { ProductsStats } from "./productsStats";
import { ProductsTable } from "./productsTable";
import { ProductsToolbar } from "./productsToolbar";
import useExportProducts from "../hooks/useExportProducts";
import { toListParams } from "../lib/productList";

export const PRODUCTS_SEARCH_ID = "products-search";

/** صفحة إدارة المنتجات: إحصائيات سريعة + بحث وفلاتر + بطاقات أو جدول. */
export function ProductsScreen() {
  const router = useRouter();
  const list = useProductsList();
  const { view, setView } = useProductsView();
  const [importOpen, setImportOpen] = useState(false);
  const exportMutation = useExportProducts();

  const exportToExcel = () => {
    if (exportMutation.isPending) return;
    // يصدّر حسب الفلاتر الحالية (بدون ترقيم الصفحات).
    exportMutation.mutate(toListParams(list.filters));
  };
  // الاختصارات لا تعمل والنافذة مفتوحة.
  const whenIdle = (fn: () => void) => () => {
    if (!importOpen) fn();
  };

  useHotkey(
    PRODUCTS_SHORTCUTS.focusSearch.match,
    whenIdle(() => {
      const input = document.getElementById(
        PRODUCTS_SEARCH_ID,
      ) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }),
  );
  useHotkey(
    PRODUCTS_SHORTCUTS.importExcel.match,
    whenIdle(() => setImportOpen(true)),
  );
  useHotkey(PRODUCTS_SHORTCUTS.exportExcel.match, whenIdle(exportToExcel));
  useHotkey(
    PRODUCTS_SHORTCUTS.newProduct.match,
    whenIdle(() => router.push(PRODUCT_ROUTES.new)),
  );
  useHotkey(
    PRODUCTS_SHORTCUTS.toggleView.match,
    whenIdle(() => setView(view === "cards" ? "table" : "cards")),
  );

  const actions = {
    onToggleActive: list.toggleActive,
    onDuplicate: list.duplicate,
    onRemove: list.remove,
  };

  function renderBody() {
    if (list.isPending) {
      return (
        <p className="border border-dashed py-16 text-center text-sm text-muted-foreground">
          جارٍ تحميل الأصناف…
        </p>
      );
    }

    if (list.isError) {
      return (
        <div className="flex flex-col items-center gap-3 border border-dashed py-16 text-center">
          <p role="alert" className="text-sm text-destructive">
            {extractErrorMessage(list.error, "تعذّر تحميل الأصناف")}
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

    if (list.products.length === 0) {
      return (
        <ProductsEmpty
          hasProducts={list.summary.total > 0}
          onClearFilters={list.clearFilters}
          onImport={() => setImportOpen(true)}
        />
      );
    }

    return view === "cards" ? (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            index={index}
            {...actions}
          />
        ))}
      </div>
    ) : (
      <ProductsTable products={list.products} {...actions} />
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">المنتجات</h1>
          <p className="text-xs text-muted-foreground">
            أدر أصنافك وأسعارك ومخزونك من مكان واحد.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={exportMutation.isPending}
          onClick={exportToExcel}
          className="h-10 gap-2 font-normal"
        >
          {exportMutation.isPending ? (
            <IconLoader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <IconDownload className="size-4" aria-hidden />
          )}
          <span className="hidden sm:inline">
            {list.filtered ? "تصدير النتائج" : "تصدير إلى Excel"}
          </span>
          <span className="sm:hidden">تصدير</span>
          <ShortcutBadge className="hidden rounded-none lg:inline-flex">
            {PRODUCTS_SHORTCUTS.exportExcel.label}
          </ShortcutBadge>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => setImportOpen(true)}
          className="h-10 gap-2 font-normal"
        >
          <IconFileSpreadsheet className="size-4" />
          <span className="hidden sm:inline">استيراد من Excel</span>
          <span className="sm:hidden">استيراد</span>
          <ShortcutBadge className="hidden rounded-none lg:inline-flex">
            {PRODUCTS_SHORTCUTS.importExcel.label}
          </ShortcutBadge>
        </Button>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={PRODUCT_ROUTES.new} />}
          className="h-10 gap-2"
        >
          <IconPlus className="size-4" />
          صنف جديد
          <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
            {PRODUCTS_SHORTCUTS.newProduct.label}
          </ShortcutBadge>
        </Button>
      </header>

      <ProductsStats
        summary={list.summary}
        stock={list.filters.stock}
        onStockChange={(stock) => list.patchFilters({ stock })}
      />

      <ProductsToolbar
        filters={list.filters}
        onChange={list.patchFilters}
        view={view}
        onViewChange={setView}
      />

      <p aria-live="polite" className="text-xs text-muted-foreground">
        عرض{" "}
        <bdi dir="ltr" className="font-mono">
          {list.products.length}
        </bdi>{" "}
        من{" "}
        <bdi dir="ltr" className="font-mono">
          {list.total}
        </bdi>{" "}
        صنف
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

      {list.total > 0 && (
        <ProductsPagination
          total={list.total}
          page={list.page}
          pageSize={list.filters.pageSize}
          onPageChange={(page) => list.patchFilters({ page })}
          onPageSizeChange={(pageSize) => list.patchFilters({ pageSize })}
        />
      )}

      <ImportExcelDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
