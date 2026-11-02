"use client";

import { IconPackageOff } from "@tabler/icons-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { extractErrorMessage } from "@/lib/errors";

import { PRODUCT_ROUTES } from "../config/productRoutes";
import useGetProduct from "../hooks/useGetProduct";
import { ProductForm } from "./productForm";

/** صفحة إضافة (بدون id) أو تعديل (مع id) صنف. */
export function ProductFormScreen({ productId }: { productId?: string }) {
  const { data: product, isPending, isError, error } = useGetProduct(productId);

  if (!productId) return <ProductForm key="new" />;

  if (isPending) {
    return (
      <p className="py-24 text-center text-sm text-muted-foreground">
        جارٍ تحميل الصنف…
      </p>
    );
  }

  if (isError || !product) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-24 text-center">
        <IconPackageOff className="size-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">لم نجد هذا الصنف</p>
          <p className="text-xs text-muted-foreground">
            {extractErrorMessage(error, "ربما حُذف أو الرابط غير صحيح.")}
          </p>
        </div>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={PRODUCT_ROUTES.list} />}
        >
          رجوع إلى المنتجات
        </Button>
      </div>
    );
  }

  return <ProductForm key={product.id} product={product} />;
}
