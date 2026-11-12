"use client";

import { IconPackageOff } from "@tabler/icons-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { extractErrorMessage } from "@/lib/errors";

import { PRODUCT_ROUTES } from "../config/productRoutes";
import { useProductFormContext } from "../context/ProductFormContext";
import { ProductForm } from "./productForm";

export function ProductFormScreen() {
  const { productId, productData } = useProductFormContext();
  const { data: product, isPending, isError, error } = productData;

  if (!productId) return <ProductForm />;

  if (isPending) {
    // نفس شكل النموذج (عمود + لوحة جانبية) فلا تقفز الصفحة عند التحميل.
    return (
      <div
        aria-busy="true"
        aria-label="جارٍ تحميل الصنف"
        className="mx-auto flex max-w-6xl flex-col gap-4"
      >
        <Skeleton className="h-12 w-72" />
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
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

  return <ProductForm />;
}
