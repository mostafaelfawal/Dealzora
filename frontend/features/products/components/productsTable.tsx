"use client";

import { IconBarcode, IconPackage } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

import { AppTable } from "@/components/shared/app-table/AppTable";
import type {
  AppTableBulkActions,
  AppTableColumn,
  AppTablePaginationProps,
} from "@/components/shared/app-table/types";
import { Money } from "@/components/shared/Money";
import { Switch } from "@/components/ui/switch";
import { PosStockBadge } from "@/features/pos/components/posStockBadge";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import { PRODUCT_ROUTES } from "../config/productRoutes";
import type { Product } from "../types/product";
import { ProductActionsMenu, type ProductActions } from "./productActionsMenu";
import { ProductMarginBadge } from "./productMarginBadge";

interface Props extends ProductActions {
  products: Product[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  isFiltered: boolean;
  onClearFilters: () => void;
  emptyAction: React.ReactNode;
  pagination: AppTablePaginationProps;
  bulkActions: AppTableBulkActions<Product>;
}

export function ProductsTable({
  products,
  isFiltered,
  onClearFilters,
  emptyAction,
  pagination,
  bulkActions,
  onRetry,
  errorMessage,
  isLoading,
  isFetching,
  isError,
  ...actions
}: Props) {
  const router = useRouter();

  const columns: AppTableColumn<Product>[] = [
    {
      id: "name",
      header: "الصنف",
      skeletonClassName: "w-40",
      cell: (p) => (
        <div className={cn("min-w-0", !p.isActive && "opacity-60")}>
          <span className="block max-w-64 truncate text-xs font-medium">
            {p.name}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <IconBarcode className="size-3.5" aria-hidden />
            <span dir="ltr" className="font-mono">
              {p.barcode || "بدون باركود"}
            </span>
          </span>
        </div>
      ),
    },
    {
      id: "category",
      header: "القسم",
      className: "hidden md:table-cell",
      cellClassName: "text-muted-foreground",
      cell: (p) => p.categoryName ?? "بدون قسم",
    },
    {
      id: "cost",
      header: "الشراء",
      className: "hidden lg:table-cell",
      cell: (p) =>
        p.costPrice === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <Money
            amount={p.costPrice}
            className="text-xs text-muted-foreground"
          />
        ),
    },
    {
      id: "sale",
      header: "البيع",
      cell: (p) => (
        <>
          <Money amount={p.salePrice} className="text-sm" />
          <span className="block text-[11px] text-muted-foreground">
            / {p.unit}
          </span>
        </>
      ),
    },
    {
      id: "margin",
      header: "الهامش",
      className: "hidden lg:table-cell",
      cell: (p) =>
        p.costPrice !== null && (
          <ProductMarginBadge cost={p.costPrice} sale={p.salePrice} />
        ),
    },
    {
      id: "stock",
      header: "المخزون",
      cell: (p) => (
        <div className="flex flex-wrap items-center gap-2">
          <bdi dir="ltr" className="font-mono text-sm tabular-nums">
            {formatQty(p.stock)}
          </bdi>
          <PosStockBadge product={p} />
        </div>
      ),
    },
    {
      id: "active",
      header: "مفعّل",
      className: "w-20",
      cell: (p) => (
        <Switch
          size="sm"
          checked={p.isActive}
          onCheckedChange={() => actions.onToggleActive(p.id)}
          aria-label={`${p.isActive ? "تعطيل" : "تفعيل"} ${p.name}`}
        />
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">إجراءات</span>,
      className: "w-12 pe-2",
      cell: (p) => <ProductActionsMenu product={p} {...actions} />,
    },
  ];

  return (
    <AppTable
      data={products}
      columns={columns}
      getRowId={(p) => p.id}
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      errorMessage={errorMessage}
      onRetry={onRetry}
      empty={{
        icon: IconPackage,
        title: "لا توجد أصناف بعد",
        description:
          "أضف أول صنف، أو استورد قائمتك كاملة من Excel في دقيقة واحدة.",
        action: emptyAction,
      }}
      noResults={{ title: "لا توجد أصناف مطابقة" }}
      isFiltered={isFiltered}
      onClearFilters={onClearFilters}
      onRowClick={(p) => router.push(PRODUCT_ROUTES.edit(p.id))}
      rowClassName={(p) => (!p.isActive ? "bg-muted/20" : undefined)}
      selectable
      getRowLabel={(p) => p.name}
      bulkActions={bulkActions}
      pagination={pagination}
    />
  );
}
