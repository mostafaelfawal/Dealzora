"use client";

import { IconLogout, IconSettings } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
import { AUTH_ROUTES } from "@/features/auth/config/authRoutes";
import { clearSession } from "@/features/auth/lib/authStorage";
import { logout } from "@/features/settings/api/settings.api";
import type { SessionUser } from "@/types/auth";

interface UserMenuProps {
  user: SessionUser;
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await logout(); // يلغي الجلسة في الـ backend
    } catch {
      // حتى لو فشل الطلب نمسح الجلسة محلياً.
    }
    clearSession();
    router.replace(AUTH_ROUTES.login);
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
        <DropdownMenuItem render={<Link href="/admin/settings" />}>
          <IconSettings className="size-4" />
          الإعدادات وكلمة المرور
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void handleLogout()}>
          <IconLogout className="size-4" />
          تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
