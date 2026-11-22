"use client";

import {
  IconCalendarDollar,
  IconCash,
  IconDots,
  IconListDetails,
  IconEye,
  IconEyeOff,
  IconFileText,
  IconGift,
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
import { useFeature } from "@/lib/plan";

import type { Customer } from "../types/customer";

export interface CustomerActions {
  onEdit: (id: string) => void;
  onStatement: (id: string) => void;
  onLoyalty: (id: string) => void;
  onCollect: (id: string) => void;
  /** تقسيط مديونيته (خطة «سوق»). */
  onInstallment: (id: string) => void;
  onToggleActive: (id: string) => void;
  onRemove: (id: string) => void;
}

/** قائمة إجراءات العميل (تُستخدم في البطاقة والجدول). */
export function CustomerActionsMenu({
  customer,
  onEdit,
  onStatement,
  onLoyalty,
  onCollect,
  onInstallment,
  onToggleActive,
  onRemove,
}: { customer: Customer } & CustomerActions) {
  // نقاط الولاء والتقسيط من خطة «سوق»
  const loyalty = useFeature("loyalty");
  const installments = useFeature("installments");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`خيارات ${customer.name}`}
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
          disabled={customer.balance === 0}
          onClick={() => onCollect(customer.id)}
        >
          <IconCash />
          {customer.balance < 0 ? "صرف رصيده نقداً" : "تحصيل دفعة"}
        </DropdownMenuItem>
        {installments && (
          <>
            <DropdownMenuItem
              disabled={customer.balance <= 0 || !customer.isActive}
              onClick={() => onInstallment(customer.id)}
            >
              <IconCalendarDollar />
              قسّط مديونيته
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <Link
                  href={`/admin/installments?q=${encodeURIComponent(customer.name)}`}
                />
              }
            >
              <IconListDetails />
              خطط التقسيط
            </DropdownMenuItem>
          </>
        )}
        {loyalty && (
          <DropdownMenuItem onClick={() => onLoyalty(customer.id)}>
            <IconGift />
            نقاط الولاء
          </DropdownMenuItem>
        )}
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
          حذف العميل
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
