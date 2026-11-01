"use client";

import {
  IconPlus,
  IconSearch,
  IconShoppingCartPlus,
  IconUserPlus,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { getNavigationForRole } from "@/config/navigation";
import { SHORTCUTS } from "@/config/shortcuts";
import { useHotkey } from "@/hooks/useHotkey";
import { useShellData } from "@/hooks/useShellData";
import { Button } from "@/components/ui/button";

const QUICK_ACTIONS = [
  {
    title: "بيع جديد",
    href: "/pos",
    icon: IconShoppingCartPlus,
    shortcut: SHORTCUTS.newSale.label,
  },
  { title: "إضافة صنف", href: "/products/new", icon: IconPlus },
  { title: "إضافة عميل", href: "/customers/new", icon: IconUserPlus },
];

/**
 * بحث شامل (Ctrl+K).
 * حالياً: إجراءات سريعة + انتقال بين الصفحات.
 * TODO: أضف مجموعات نتائج حقيقية (أصناف / عملاء / فواتير) من الـ API.
 */
export function GlobalSearch() {
  const router = useRouter();
  const { user } = useShellData();
  const [open, setOpen] = useState(false);

  const pages = getNavigationForRole(user.role).flatMap((group) => group.items);

  useHotkey(SHORTCUTS.globalSearch.match, () => setOpen((prev) => !prev));

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        onClick={() => setOpen(true)}
        aria-label="بحث شامل"
        className="w-9 justify-center px-0 font-normal text-muted-foreground sm:w-full sm:max-w-sm sm:justify-start sm:gap-2 sm:px-2.5"
      >
        <IconSearch className="size-4 shrink-0" />
        <span className="hidden flex-1 truncate text-start sm:inline">
          ابحث عن صنف أو عميل أو فاتورة
        </span>
        <ShortcutBadge className="hidden lg:inline-flex">
          {SHORTCUTS.globalSearch.label}
        </ShortcutBadge>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        className="sm:max-w-lg"
        title="بحث شامل"
        description="ابحث عن صنف أو عميل أو فاتورة، أو انتقل لأي صفحة"
      >
        <CommandInput placeholder="اكتب للبحث…" />
        <CommandList>
          <CommandEmpty>مفيش نتائج مطابقة</CommandEmpty>

          <CommandGroup heading="إجراءات سريعة">
            {QUICK_ACTIONS.map(({ title, href, icon: Icon, shortcut }) => (
              <CommandItem key={href} onSelect={() => go(href)}>
                <Icon className="size-4" />
                <span>{title}</span>
                {shortcut && (
                  <ShortcutBadge className="ms-auto">{shortcut}</ShortcutBadge>
                )}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="الصفحات">
            {pages.map(({ title, href, icon: Icon }) => (
              <CommandItem key={href} onSelect={() => go(href)}>
                <Icon className="size-4" />
                <span>{title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
