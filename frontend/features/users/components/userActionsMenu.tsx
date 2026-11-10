"use client";

import {
  IconDots,
  IconEye,
  IconEyeOff,
  IconKey,
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

import { USER_ROUTES } from "../config/userRoutes";
import type { User } from "../types/user";

export interface UserActions {
  /** حساب المدير الحالي: التعطيل والحذف وتغيير كلمة المرور ممنوعة عليه من هنا. */
  currentUserId: string | null;
  onToggleActive: (id: string) => void;
  onResetPassword: (id: string) => void;
  onRemove: (id: string) => void;
}

/** قائمة إجراءات المستخدم (تُستخدم في البطاقة والجدول). */
export function UserActionsMenu({
  user,
  currentUserId,
  onToggleActive,
  onResetPassword,
  onRemove,
}: { user: User } & UserActions) {
  const isSelf = user.id === currentUserId;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`إجراءات ${user.username}`}
            className="size-8"
          />
        }
      >
        <IconDots />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem render={<Link href={USER_ROUTES.edit(user.id)} />}>
          <IconPencil />
          تعديل
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isSelf}
          onClick={() => onResetPassword(user.id)}
        >
          <IconKey />
          تغيير كلمة المرور
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isSelf}
          onClick={() => onToggleActive(user.id)}
        >
          {user.isActive ? <IconEyeOff /> : <IconEye />}
          {user.isActive ? "تعطيل" : "تفعيل"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isSelf}
          onClick={() => onRemove(user.id)}
        >
          <IconTrash />
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
