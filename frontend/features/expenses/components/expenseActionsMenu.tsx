"use client";

import { IconDots, IconPencil, IconTrash } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { categoryLabel } from "../lib/expenseCalc";
import type { Expense } from "../types/expense";

export interface ExpenseActions {
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}

/** قائمة إجراءات المصروف (تُستخدم في البطاقة والجدول). */
export function ExpenseActionsMenu({
  expense,
  onEdit,
  onRemove,
}: { expense: Expense } & ExpenseActions) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`إجراءات مصروف ${categoryLabel(expense.category)}`}
            className="size-8"
          />
        }
      >
        <IconDots />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-44"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem onClick={() => onEdit(expense.id)}>
          <IconPencil />
          تعديل
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onRemove(expense.id)}
        >
          <IconTrash />
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}