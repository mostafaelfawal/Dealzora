import { IconFilterOff, IconPlus, IconUsers } from "@tabler/icons-react";
import Link from "next/link";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";

import { USER_ROUTES } from "../config/userRoutes";
import { USERS_SHORTCUTS } from "../config/userShortcuts";

/** حالة فارغة: إما لا مستخدمين بعد (دعوة للبدء)، أو لا نتائج مطابقة (مسح الفلاتر). */
export function UsersEmpty({
  hasUsers,
  onClearFilters,
}: {
  hasUsers: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed py-16 text-center">
      {hasUsers ? (
        <>
          <IconFilterOff className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">لا يوجد مستخدمون مطابقون</p>
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
          <IconUsers className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">لا يوجد مستخدمون بعد</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              أضف أول كاشير وحدّد له كلمة مرور ليبدأ العمل.
            </p>
          </div>
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href={USER_ROUTES.new} />}
            className="gap-2"
          >
            <IconPlus />
            مستخدم جديد
            <ShortcutBadge className="border-primary-foreground/30 text-primary-foreground/80">
              {USERS_SHORTCUTS.newUser.label}
            </ShortcutBadge>
          </Button>
        </>
      )}
    </div>
  );
}
