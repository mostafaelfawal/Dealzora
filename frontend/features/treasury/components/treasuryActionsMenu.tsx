"use client";

import { IconDots, IconTrash } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { CashEntry } from "../types/treasury";

export interface TreasuryActions {
  onRemove: (id: string) => void;
}

/** قائمة إجراءات الحركة (تُستخدم في البطاقة والجدول). الحركات التلقائية تُحذف من مصدرها فقط. */
export function TreasuryActionsMenu({
  entry,
  onRemove,
}: { entry: CashEntry } & TreasuryActions) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`إجراءات حركة ${entry.note || "الخزنة"}`}
            className="size-8"
          />
        }
      >
        <IconDots />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          variant="destructive"
          disabled={entry.isLinked}
          onClick={() => onRemove(entry.id)}
        >
          <IconTrash />
          {entry.isLinked ? "حذف (من المصدر فقط)" : "حذف"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
