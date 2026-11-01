import { IconArrowRight, IconTrash, IconUser } from "@tabler/icons-react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { POS_SHORTCUTS } from "../config/posShortcuts";
import type { PosCustomer } from "../types/pos";

interface PosCartHeaderProps {
  customer: PosCustomer | null;
  itemCount: number;
  onCustomer: () => void;
  onCancel: () => void;
  /** رجوع لقائمة الأصناف (موبايل فقط). */
  onBack: () => void;
}

export function PosCartHeader({
  customer,
  itemCount,
  onCustomer,
  onCancel,
  onBack,
}: PosCartHeaderProps) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="lg:hidden"
        aria-label="رجوع للأصناف"
        onClick={onBack}
      >
        <IconArrowRight className="size-5" />
      </Button>

      <div className="min-w-0">
        <h2 className="text-sm font-medium">فاتورة جديدة</h2>
        <p className="text-xs text-muted-foreground">{itemCount} صنف</p>
      </div>

      <div className="ms-auto flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onCustomer}
          className="max-w-44 gap-2 font-normal"
        >
          <IconUser className="size-4 shrink-0" />
          <span className="truncate">
            {customer ? customer.name : "عميل نقدي"}
          </span>
          <ShortcutBadge className="hidden rounded-none xl:inline-flex">
            {POS_SHORTCUTS.customer.label}
          </ShortcutBadge>
        </Button>

        <AppTooltip
          message={`إلغاء الفاتورة (${POS_SHORTCUTS.cancelInvoice.label})`}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label="إلغاء الفاتورة"
            disabled={itemCount === 0}
            onClick={onCancel}
          >
            <IconTrash className="size-4" />
          </Button>
        </AppTooltip>
      </div>
    </div>
  );
}
