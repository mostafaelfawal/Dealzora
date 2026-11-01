"use client";

import { IconLogout, IconSettings, IconUser } from "@tabler/icons-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/config/roles";
import type { SessionUser } from "@/types/auth";

interface UserMenuProps {
  user: SessionUser;
}

export function UserMenu({ user }: UserMenuProps) {
  function handleLogout() {
    // TODO: اربطها بتسجيل الخروج الحقيقي.
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="lg"
            className="gap-2 px-1.5 font-normal"
            aria-label="قائمة المستخدم"
          />
        }
      >
        <Avatar className="size-7">
          <AvatarFallback className="text-xs">
            {user.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-sm 2xl:inline">{user.name}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">{user.name}</p>
            <p className="text-xs">{ROLE_LABELS[user.role]}</p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>
          <IconUser className="size-4" />
          الملف الشخصي
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings" />}>
          <IconSettings className="size-4" />
          الإعدادات
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <IconLogout className="size-4" />
          تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
