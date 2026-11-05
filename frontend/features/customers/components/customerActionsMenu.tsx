"use client";

import {
  IconCash,
  IconDots,
  IconEye,
  IconEyeOff,
  IconFileText,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Customer } from "../types/customer";

export interface CustomerActions {
  onEdit: (id: string) => void;
  onStatement: (id: string) => void;
  onCollect: (id: string) => void;
  onToggleActive: (id: string) => void;
  onRemove: (id: string) => void;
}

/** قائمة إجراءات العميل (تُستخدم في البطاقة والجدول). */
export function CustomerActionsMenu({
  customer,
  onEdit,
  onStatement,
  onCollect,
  onToggleActive,
  onRemove,
}: { customer: Customer } & CustomerActions) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`إجراءات ${customer.name}`}
            className="size-8"
          />
        }
      >
        <IconDots />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onStatement(customer.id)}>
          <IconFileText />
          كشف الحساب
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={customer.balance <= 0}
          onClick={() => onCollect(customer.id)}
        >
          <IconCash />
          تحصيل دفعة
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(customer.id)}>
          <IconPencil />
          تعديل البيانات
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggleActive(customer.id)}>
          {customer.isActive ? <IconEyeOff /> : <IconEye />}
          {customer.isActive ? "تعطيل" : "تفعيل"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onRemove(customer.id)}
        >
          <IconTrash />
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
