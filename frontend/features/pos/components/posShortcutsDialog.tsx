"use client";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  POS_PAYMENT_KEYS,
  POS_SEARCH_KEYS,
  POS_SHORTCUTS,
  type PosKeyHint,
} from "../config/posShortcuts";
import { posUiActions } from "../store/posUiSlice";

const GLOBAL_KEYS: PosKeyHint[] = Object.values(POS_SHORTCUTS).map((s) => ({
  keys: s.label,
  description: s.description,
}));

function Group({ title, items }: { title: string; items: PosKeyHint[] }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-medium">{title}</h3>
      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.keys}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="text-muted-foreground">{item.description}</span>
            <ShortcutBadge className="shrink-0 rounded-none">
              {item.keys}
            </ShortcutBadge>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PosShortcutsDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.posUi.dialog === "shortcuts");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && dispatch(posUiActions.closeDialog())}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[85dvh] gap-3 overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader className="text-start">
          <DialogTitle>اختصارات الكاشير</DialogTitle>
          <DialogDescription>
            جميعها تعمل وأنت في خانة الباركود.
          </DialogDescription>
        </DialogHeader>
        <Group title="الشاشة" items={GLOBAL_KEYS} />
        <Separator />
        <Group title="خانة الباركود" items={POS_SEARCH_KEYS} />
        <Separator />
        <Group title="نافذة الدفع" items={POS_PAYMENT_KEYS} />
      </DialogContent>
    </Dialog>
  );
}
