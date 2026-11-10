"use client";

import { IconKeyboard } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NAV_HOTKEYS } from "@/config/navigation";
import { SHORTCUTS } from "@/config/shortcuts";
import { useHotkey } from "@/hooks/useHotkey";

const GENERAL = [
  { keys: SHORTCUTS.newSale.label, label: "بيع جديد (الكاشير)" },
  { keys: SHORTCUTS.globalSearch.label, label: "بحث شامل: صنف، عميل، فاتورة، صفحة" },
  { keys: "F4", label: "إضافة جديد في الصفحة الحالية" },
  { keys: "F6", label: "تبديل العرض (بطاقات / جدول)" },
  { keys: "/", label: "الانتقال لخانة البحث في الصفحة" },
  { keys: "Esc", label: "إغلاق النافذة المفتوحة" },
  { keys: "Ctrl /", label: "قائمة الاختصارات هذه" },
];

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * اختصارات التنقل على مستوى لوحة التحكم:
 * Alt + رقم = صفحة، "/" = خانة البحث، Ctrl + / = قائمة الاختصارات.
 * نطابق event.code حتى تعمل مع لوحة المفاتيح العربية.
 */
export function NavHotkeys() {
  const router = useRouter();
  const [help, setHelp] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        const digit = /^Digit(\d)$/.exec(event.code)?.[1];
        const item = digit && NAV_HOTKEYS.find((i) => i.hotkey === Number(digit));
        if (item) {
          event.preventDefault();
          router.push(item.href);
        }
        return;
      }
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !isTyping(event.target)) {
        const search = document.querySelector<HTMLInputElement>("[data-page-search]");
        if (search) {
          event.preventDefault();
          search.focus();
          search.select();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  useHotkey(
    (e) => (e.ctrlKey || e.metaKey) && e.code === "Slash",
    () => setHelp((v) => !v),
  );

  return (
    <Dialog open={help} onOpenChange={setHelp}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center gap-2">
            <IconKeyboard className="size-5" />
            اختصارات لوحة المفاتيح
          </DialogTitle>
          <DialogDescription>اشتغل أسرع بدون الماوس.</DialogDescription>
        </DialogHeader>
        <section className="space-y-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">عام</h3>
          <ul className="divide-y border">
            {GENERAL.map((s) => (
              <li key={s.keys} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <span>{s.label}</span>
                <ShortcutBadge>{s.keys}</ShortcutBadge>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">التنقل بين الصفحات</h3>
          <ul className="grid grid-cols-2 gap-px border bg-border">
            {NAV_HOTKEYS.map((item) => (
              <li
                key={item.href}
                className="flex items-center justify-between gap-2 bg-background px-3 py-2 text-xs"
              >
                <span className="truncate">{item.title}</span>
                <ShortcutBadge>Alt {item.hotkey}</ShortcutBadge>
              </li>
            ))}
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}
