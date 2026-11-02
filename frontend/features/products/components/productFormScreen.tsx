import { IconPackageOff } from "@tabler/icons-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { PRODUCT_ROUTES } from "../config/productRoutes";
import { PRODUCTS } from "../mocks/productsData";
import { ProductForm } from "./productForm";

/**
 * صفحة إضافة (بدون id) أو تعديل (مع id) صنف.
 * TODO: اقرأ الصنف من قاعدة البيانات المحلية بدل PRODUCTS.
 */
export function ProductFormScreen({ productId }: { productId?: string }) {
  const product = productId
    ? PRODUCTS.find((p) => p.id === productId)
    : undefined;

  if (productId && !product) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-24 text-center">
        <IconPackageOff className="size-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">لم نجد هذا الصنف</p>
          <p className="text-xs text-muted-foreground">
            ربما حُذف أو الرابط غير صحيح.
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

  // key يعيد بناء الفورم بالكامل عند التنقل بين صنفين.
  return <ProductForm key={product?.id ?? "new"} product={product} />;
}
