import {
  IconFileSpreadsheet,
  IconFilterOff,
  IconPackage,
  IconPlus,
} from "@tabler/icons-react";
import Link from "next/link";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";

import { PRODUCT_ROUTES } from "../config/productRoutes";
import { PRODUCTS_SHORTCUTS } from "../config/productShortcuts";

/** حالة فارغة: إما لا أصناف بعد (دعوة للبدء)، أو لا نتائج مطابقة (مسح الفلاتر). */
export function ProductsEmpty({
  hasProducts,
  onClearFilters,
  onImport,
}: {
  hasProducts: boolean;
  onClearFilters: () => void;
  onImport: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed py-16 text-center">
      {hasProducts ? (
        <>
          <IconFilterOff className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">لا توجد أصناف مطابقة</p>
            <p className="text-xs text-muted-foreground">
              جرّب كلمة أخرى أو امسح الفلاتر.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onClearFilters}
          >
            مسح الفلاتر
          </Button>
        </>
      ) : (
        <>
          <IconPackage className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">لا توجد أصناف بعد</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              أضف أول صنف، أو استورد قائمتك كاملة من Excel في دقيقة واحدة.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href={PRODUCT_ROUTES.new} />}
              className="gap-2"
            >
              <IconPlus />
              صنف جديد
              <ShortcutBadge className="border-primary-foreground/30 text-primary-foreground/80">
                {PRODUCTS_SHORTCUTS.newProduct.label}
              </ShortcutBadge>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onImport}
              className="gap-2 font-normal"
            >
              <IconFileSpreadsheet />
              استيراد من Excel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
