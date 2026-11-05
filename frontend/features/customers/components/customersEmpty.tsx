import { IconFilterOff, IconPlus, IconUsers } from "@tabler/icons-react";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";

import { CUSTOMERS_SHORTCUTS } from "../config/customerShortcuts";

/** حالة فارغة: إما لا عملاء بعد (دعوة للبدء)، أو لا نتائج مطابقة (مسح الفلاتر). */
export function CustomersEmpty({
  hasCustomers,
  onClearFilters,
  onAdd,
}: {
  hasCustomers: boolean;
  onClearFilters: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed py-16 text-center">
      {hasCustomers ? (
        <>
          <IconFilterOff className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">لا يوجد عملاء مطابقون</p>
            <p className="text-xs text-muted-foreground">
              جرّب جزءاً من الاسم أو آخر أرقام الهاتف، أو امسح الفلاتر.
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
          <IconUsers className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">لا يوجد عملاء بعد</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              أضف عملاءك الدائمين لتبيع لهم بالآجل وتتابع مديونياتهم وتحصّل
              دفعاتهم من مكان واحد.
            </p>
          </div>
          <Button size="lg" onClick={onAdd} className="gap-2">
            <IconPlus />
            إضافة أول عميل
            <ShortcutBadge className="border-primary-foreground/30 text-primary-foreground/80">
              {CUSTOMERS_SHORTCUTS.newCustomer.label}
            </ShortcutBadge>
          </Button>
        </>
      )}
    </div>
  );
}
