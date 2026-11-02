"use client";

import {
  IconBarcode,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PosStockBadge } from "@/features/pos/components/posStockBadge";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import { PRODUCT_ROUTES } from "../config/productRoutes";
import { getCategoryLabel } from "../lib/productList";
import type { Product } from "../types/product";
import { ProductActionsMenu, type ProductActions } from "./productActionsMenu";
import { ProductMarginBadge } from "./productMarginBadge";
import { listRow, MotionTr } from "@/components/shared/motion";

const th = "h-9 px-3 text-start text-xs font-normal text-muted-foreground";

const PAGE_SIZES = [10, 25, 50, 100];
const PAGE_SIZE_ITEMS = PAGE_SIZES.map((size) => ({
  value: String(size),
  label: String(size),
}));

/** أرقام الصفحات مع "…" لو العدد كبير: 1 … 4 5 6 … 20 */
function getPageItems(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const items: (number | "gap")[] = [];
  sorted.forEach((page, i) => {
    if (i > 0 && page - sorted[i - 1] > 1) items.push("gap");
    items.push(page);
  });
  return items;
}

/** جدول المنتجات. الضغط على الصف يفتح التعديل، وعناصر التحكم بداخله لا تفعل ذلك. */
export function ProductsTable({
  products,
  ...actions
}: { products: Product[] } & ProductActions) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  const total = products.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // لو الصفحة الحالية اختفت (حذف أو فلترة) نرجع لآخر صفحة موجودة.
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageProducts = products.slice(start, end);
  const pageItems = getPageItems(currentPage, pageCount);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto border bg-card">
        <table className="w-full min-w-170 text-xs">
          <thead className="bg-muted/40">
            <tr className="border-b">
              <th scope="col" className={th}>
                الصنف
              </th>
              <th scope="col" className={cn(th, "hidden md:table-cell")}>
                القسم
              </th>
              <th scope="col" className={cn(th, "hidden lg:table-cell")}>
                الشراء
              </th>
              <th scope="col" className={th}>
                البيع
              </th>
              <th scope="col" className={cn(th, "hidden lg:table-cell")}>
                الهامش
              </th>
              <th scope="col" className={th}>
                المخزون
              </th>
              <th scope="col" className={cn(th, "w-20")}>
                مفعّل
              </th>
              <th scope="col" className="w-12">
                <span className="sr-only">إجراءات</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageProducts.map((product, index) => (
              <MotionTr
                {...listRow(index)}
                key={product.id}
                style={{ animationDelay: `${Math.min(index, 12) * 20}ms` }}
                onClick={(event) => {
                  if (
                    (event.target as HTMLElement).closest(
                      "a, button, input, [role='switch']",
                    )
                  )
                    return;
                  router.push(PRODUCT_ROUTES.edit(product.id));
                }}
                className="h-14 cursor-pointer border-b fill-mode-backwards duration-300 last:border-b-0 hover:bg-muted/50"
              >
                <td
                  className={cn(
                    "min-w-0 px-3",
                    !product.isActive && "opacity-60",
                  )}
                >
                  <Link
                    href={PRODUCT_ROUTES.edit(product.id)}
                    className="block max-w-64 truncate text-xs font-medium outline-none hover:underline focus-visible:underline"
                  >
                    {product.name}
                  </Link>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <IconBarcode className="size-3.5" aria-hidden />
                    <span dir="ltr" className="font-mono">
                      {product.barcode || "بدون باركود"}
                    </span>
                  </span>
                </td>
                <td className="hidden px-3 text-muted-foreground md:table-cell">
                  {getCategoryLabel(product.category)}
                </td>
                <td className="hidden px-3 lg:table-cell">
                  <Money
                    amount={product.costPrice}
                    className="text-xs text-muted-foreground"
                  />
                </td>
                <td className="px-3">
                  <Money amount={product.salePrice} className="text-sm" />
                  <span className="block text-[11px] text-muted-foreground">
                    / {product.unit}
                  </span>
                </td>
                <td className="hidden px-3 lg:table-cell">
                  <ProductMarginBadge
                    cost={product.costPrice}
                    sale={product.salePrice}
                  />
                </td>
                <td className="px-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <bdi dir="ltr" className="font-mono text-sm tabular-nums">
                      {formatQty(product.stock)}
                    </bdi>
                    <PosStockBadge product={product} />
                  </div>
                </td>
                <td className="px-3">
                  <Switch
                    size="sm"
                    checked={product.isActive}
                    onCheckedChange={() => actions.onToggleActive(product.id)}
                    aria-label={`${product.isActive ? "تعطيل" : "تفعيل"} ${product.name}`}
                  />
                </td>
                <td className="pe-2">
                  <ProductActionsMenu product={product} {...actions} />
                </td>
              </MotionTr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- Pagination ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
          <span aria-live="polite">
            عرض{" "}
            <bdi dir="ltr" className="font-mono text-foreground tabular-nums">
              {total === 0 ? 0 : start + 1}–{end}
            </bdi>{" "}
            من{" "}
            <bdi dir="ltr" className="font-mono tabular-nums">
              {total}
            </bdi>
          </span>

          <div className="flex items-center gap-2">
            <span>صفوف في الصفحة</span>
            <Select
              items={PAGE_SIZE_ITEMS}
              value={String(pageSize)}
              onValueChange={(value) => {
                if (!value) return;
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger
                aria-label="عدد الصفوف في الصفحة"
                className="w-20 data-[size=default]:h-8"
              >
                <SelectValue className="text-start" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {PAGE_SIZE_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {pageCount > 1 && (
          <nav
            aria-label="التنقل بين الصفحات"
            className="flex items-center gap-1"
          >
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="الصفحة السابقة"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              className="size-8"
            >
              {/* RTL: السابق على اليمين */}
              <IconChevronRight />
            </Button>

            {pageItems.map((item, index) =>
              item === "gap" ? (
                <span
                  key={`gap-${index}`}
                  aria-hidden
                  className="px-1 text-muted-foreground"
                >
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={item === currentPage ? "default" : "outline"}
                  aria-label={`الصفحة ${item}`}
                  aria-current={item === currentPage ? "page" : undefined}
                  onClick={() => setPage(item)}
                  className="size-8 p-0 font-mono font-normal tabular-nums"
                >
                  {item}
                </Button>
              ),
            )}

            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="الصفحة التالية"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
              className="size-8"
            >
              {/* RTL: التالي على اليسار */}
              <IconChevronLeft />
            </Button>
          </nav>
        )}
      </div>
    </div>
  );
}
