import { IconFilterOff, IconPlus, IconReceipt } from "@tabler/icons-react";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";

import { EXPENSES_SHORTCUTS } from "../config/expenseShortcuts";

/** حالة فارغة: إما لا مصاريف بعد (دعوة للبدء)، أو لا نتائج مطابقة (مسح الفلاتر). */
export function ExpensesEmpty({
  hasExpenses,
  onClearFilters,
  onAdd,
}: {
  hasExpenses: boolean;
  onClearFilters: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed py-16 text-center">
      {hasExpenses ? (
        <>
          <IconFilterOff className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">لا توجد مصاريف مطابقة</p>
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
          <IconReceipt className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">لا توجد مصاريف بعد</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              سجّل مصاريفك (إيجار، كهرباء، رواتب…) لتعرف أين تذهب نقودك وتتابع
              حركة الخزنة.
            </p>
          </div>
          <Button size="lg" onClick={onAdd} className="gap-2">
            <IconPlus />
            تسجيل أول مصروف
            <ShortcutBadge className="border-primary-foreground/30 text-primary-foreground/80">
              {EXPENSES_SHORTCUTS.newExpense.label}
            </ShortcutBadge>
          </Button>
        </>
      )}
    </div>
  );
}