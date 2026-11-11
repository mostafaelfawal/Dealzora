"use client";

import {
  IconCopy,
  IconDots,
  IconEye,
  IconEyeOff,
  IconPencil,
  IconLock,
  IconPrinter,
  IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { upgradeMessage, useFeature } from "@/lib/plan";

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
import { BarcodeLabelDialog, productLabelOptions } from "./barcodeLabelDialog";

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
  const labels = useFeature("barcode_labels");
  const [printing, setPrinting] = useState(false);
  const hasBarcode = productLabelOptions(product).length > 0;

  return (
    <>
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
          <DropdownMenuItem
            disabled={!hasBarcode}
            onClick={() =>
              labels
                ? setPrinting(true)
                : toast.info(upgradeMessage("barcode_labels"), {
                    duration: 6000,
                  })
            }
          >
            {labels ? <IconPrinter /> : <IconLock />}
            طباعة باركود
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
      <BarcodeLabelDialog
        product={printing ? product : null}
        onClose={() => setPrinting(false)}
      />
    </>
  );
}
