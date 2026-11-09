"use client";

import { IconClock, IconUser } from "@tabler/icons-react";
import Link from "next/link";

import { listItem, MotionArticle } from "@/components/shared/motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { ROLE_LABEL, ROLE_TONE } from "../config/userOptions";
import { USER_ROUTES } from "../config/userRoutes";
import { lastLoginLabel } from "../lib/userFormat";
import type { User } from "../types/user";
import { UserActionsMenu, type UserActions } from "./userActionsMenu";

interface UserCardProps extends UserActions {
  user: User;
  /** ترتيب البطاقة، لتأخير ظهورها قليلاً عن اللي قبلها. */
  index: number;
}

/** بطاقة مستخدم. الاسم رابط يغطي البطاقة كلها، وقائمة الإجراءات فوقه. */
export function UserCard({ user, index, ...actions }: UserCardProps) {
  const isSelf = user.id === actions.currentUserId;

  return (
    <MotionArticle
      {...listItem(index)}
      className={cn(
        "group relative flex flex-col gap-3 border bg-card p-3.5",
        "transition-[border-color,transform] duration-150",
        "hover:border-primary/60 active:scale-[0.99]",
        "focus-within:border-primary",
      )}
    >
      <div
        className={cn("flex items-start gap-2.5", !user.isActive && "opacity-60")}
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center bg-muted text-muted-foreground"
        >
          <IconUser className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <Link
            href={USER_ROUTES.edit(user.id)}
            dir="ltr"
            className="block truncate text-start font-mono text-[13px] leading-snug font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-primary/40"
          >
            {user.username}
          </Link>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn("font-normal", ROLE_TONE[user.role])}
            >
              {ROLE_LABEL[user.role]}
            </Badge>
            {isSelf && (
              <Badge variant="secondary" className="font-normal">
                حسابك
              </Badge>
            )}
            {!user.isActive && (
              <Badge variant="secondary" className="font-normal">
                معطّل
              </Badge>
            )}
          </div>
        </div>
        <div className="relative z-10 -mt-1 -ms-1 shrink-0">
          <UserActionsMenu user={user} {...actions} />
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-1.5 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground",
          !user.isActive && "opacity-60",
        )}
      >
        <IconClock className="size-3.5 shrink-0" aria-hidden />
        <span>آخر دخول:</span>
        <span className="min-w-0 truncate text-foreground">
          {lastLoginLabel(user.lastLoginAt)}
        </span>
      </div>
    </MotionArticle>
  );
}