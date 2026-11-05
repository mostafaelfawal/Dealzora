"use client";

import {
  IconCash,
  IconDots,
  IconEye,
  IconEyeOff,
  IconPencil,
  IconReceipt,
  IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { SUPPLIER_ROUTES } from "../config/supplierRoutes";
import type { Supplier } from "../types/supplier";

export interface SupplierActions {
  onToggleActive: (id: string) => void;
  onPay: (id: string) => void;
  onRemove: (id: string) => void;
}

/** قائمة إجراءات المورد (تُستخدم في البطاقة والجدول). */
export function SupplierActionsMenu({
  supplier,
  onToggleActive,
  onPay,
  onRemove,
}: { supplier: Supplier } & SupplierActions) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`إجراءات ${supplier.name}`}
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
        <DropdownMenuItem
          render={<Link href={SUPPLIER_ROUTES.edit(supplier.id)} />}
        >
          <IconPencil />
          تعديل
        </DropdownMenuItem>
        <DropdownMenuItem
          render={<Link href={SUPPLIER_ROUTES.statement(supplier.id)} />}
        >
          <IconReceipt />
          كشف حساب
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPay(supplier.id)}>
          <IconCash />
          تسجيل دفعة
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggleActive(supplier.id)}>
          {supplier.isActive ? <IconEyeOff /> : <IconEye />}
          {supplier.isActive ? "تعطيل" : "تفعيل"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onRemove(supplier.id)}
        >
          <IconTrash />
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
