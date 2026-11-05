import { IconFilterOff, IconPlus, IconWallet } from "@tabler/icons-react";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";

import { TREASURY_SHORTCUTS } from "../config/treasuryShortcuts";

/** حالة فارغة: إما لا حركات بعد (دعوة للبدء)، أو لا نتائج مطابقة (مسح الفلاتر). */
export function TreasuryEmpty({
  filtered,
  onClearFilters,
  onAdd,
}: {
  filtered: boolean;
  onClearFilters: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed py-16 text-center">
      {filtered ? (
        <>
          <IconFilterOff className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">لا توجد حركات مطابقة</p>
            <p className="text-xs text-muted-foreground">
              جرّب فترة أو نوعاً آخر، أو امسح الفلاتر.
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
          <IconWallet className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">لا توجد حركات في الخزنة بعد</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              ابدأ برصيد افتتاحي. بعدها تظهر مصروفاتك هنا تلقائياً، ويمكنك تسجيل
              أي إيداع أو سحب يدوي.
            </p>
          </div>
          <Button size="lg" onClick={onAdd} className="gap-2">
            <IconPlus />
            إضافة رصيد افتتاحي
            <ShortcutBadge className="border-primary-foreground/30 text-primary-foreground/80">
              {TREASURY_SHORTCUTS.newEntry.label}
            </ShortcutBadge>
          </Button>
        </>
      )}
    </div>
  );
}
