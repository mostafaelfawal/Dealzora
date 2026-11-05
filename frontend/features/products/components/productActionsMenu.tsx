"use client";

import {
  IconCopy,
  IconDots,
  IconEye,
  IconEyeOff,
  IconPencil,
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

import { PRODUCT_ROUTES } from "../config/productRoutes";
import type { Product } from "../types/product";

export interface ProductActions {
  onToggleActive: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}

/** قائمة إجراءات الصنف (تُستخدم في البطاقة والجدول). */
export function ProductActionsMenu({
  product,
  onToggleActive,
  onDuplicate,
  onRemove,
}: { product: Product } & ProductActions) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`إجراءات ${product.name}`}
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
          render={<Link href={PRODUCT_ROUTES.edit(product.id)} />}
        >
          <IconPencil />
          تعديل
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDuplicate(product.id)}>
          <IconCopy />
          تكرار الصنف
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggleActive(product.id)}>
          {product.isActive ? <IconEyeOff /> : <IconEye />}
          {product.isActive ? "تعطيل" : "تفعيل"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onRemove(product.id)}
        >
          <IconTrash />
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
