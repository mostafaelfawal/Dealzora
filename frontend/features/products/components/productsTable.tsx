"use client";

import { IconBarcode } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Money } from "@/components/shared/Money";
import { listRow, MotionTr } from "@/components/shared/motion";
import { Switch } from "@/components/ui/switch";
import { PosStockBadge } from "@/features/pos/components/posStockBadge";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import { PRODUCT_ROUTES } from "../config/productRoutes";
import type { Product } from "../types/product";
import { ProductActionsMenu, type ProductActions } from "./productActionsMenu";
import { ProductMarginBadge } from "./productMarginBadge";

const th = "h-9 px-3 text-start text-xs font-normal text-muted-foreground";

/** جدول المنتجات. الضغط على الصف يفتح التعديل، وعناصر التحكم بداخله لا تفعل ذلك. */
export function ProductsTable({
  products,
  ...actions
}: { products: Product[] } & ProductActions) {
  const router = useRouter();

  return (
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
          {products.map((product, index) => (
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
                {product.categoryName ?? "بدون قسم"}
              </td>
              <td className="hidden px-3 lg:table-cell">
                {product.costPrice === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <Money
                    amount={product.costPrice}
                    className="text-xs text-muted-foreground"
                  />
                )}
              </td>
              <td className="px-3">
                <Money amount={product.salePrice} className="text-sm" />
                <span className="block text-[11px] text-muted-foreground">
                  / {product.unit}
                </span>
              </td>
              <td className="hidden px-3 lg:table-cell">
                {product.costPrice !== null && (
                  <ProductMarginBadge
                    cost={product.costPrice}
                    sale={product.salePrice}
                  />
                )}
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
  );
}
