import {
  IconBuildingStore,
  IconFilterOff,
  IconPlus,
} from "@tabler/icons-react";
import Link from "next/link";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";

import { SUPPLIER_ROUTES } from "../config/supplierRoutes";
import { SUPPLIERS_SHORTCUTS } from "../config/supplierShortcuts";

/** حالة فارغة: إما لا موردين بعد (دعوة للبدء)، أو لا نتائج مطابقة (مسح الفلاتر). */
export function SuppliersEmpty({
  hasSuppliers,
  onClearFilters,
}: {
  hasSuppliers: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed py-16 text-center">
      {hasSuppliers ? (
        <>
          <IconFilterOff className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">لا يوجد موردون مطابقون</p>
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
          <IconBuildingStore className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">لا يوجد موردون بعد</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              أضف أول مورد لتسجّل مشترياتك ومدفوعاتك وتتابع حسابه.
            </p>
          </div>
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
        </>
      )}
    </div>
  );
}
