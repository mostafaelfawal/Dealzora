"use client";

import { IconUsers } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import type {
  AppTableColumn,
  AppTablePaginationProps,
} from "@/components/shared/AppTable/types";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { ROLE_LABEL, ROLE_TONE } from "../config/userOptions";
import { USER_ROUTES } from "../config/userRoutes";
import { lastLoginLabel } from "../lib/userFormat";
import type { User } from "../types/user";
import { UserActionsMenu, type UserActions } from "./userActionsMenu";

interface Props extends UserActions {
  users: User[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  isFiltered: boolean;
  onClearFilters: () => void;
  emptyAction: React.ReactNode;
  pagination: AppTablePaginationProps;
}

export function UsersTable({
  users,
  isFiltered,
  onClearFilters,
  emptyAction,
  pagination,
  onRetry,
  errorMessage,
  isLoading,
  isFetching,
  isError,
  ...actions
}: Props) {
  const router = useRouter();

  const columns: AppTableColumn<User>[] = [
    {
      id: "username",
      header: "المستخدم",
      skeletonClassName: "w-40",
      cell: (u) => (
        <div className={cn("min-w-0", !u.isActive && "opacity-60")}>
          <span
            dir="ltr"
            className="block max-w-64 truncate text-start font-mono text-xs font-medium"
          >
            {u.username}
          </span>
          {u.id === actions.currentUserId && (
            <span className="text-[11px] text-muted-foreground">حسابك</span>
          )}
        </div>
      ),
    },
    {
      id: "role",
      header: "الدور",
      cell: (u) => (
        <Badge
          variant="outline"
          className={cn("font-normal", ROLE_TONE[u.role])}
        >
          {ROLE_LABEL[u.role]}
        </Badge>
      ),
    },
    {
      id: "lastLogin",
      header: "آخر دخول",
      className: "hidden md:table-cell",
      cellClassName: "text-muted-foreground",
      cell: (u) => (
        <span className="text-xs">{lastLoginLabel(u.lastLoginAt)}</span>
      ),
    },
    {
      id: "active",
      header: "مفعّل",
      className: "w-20",
      cell: (u) => (
        <Switch
          size="sm"
          checked={u.isActive}
          disabled={u.id === actions.currentUserId}
          onCheckedChange={() => actions.onToggleActive(u.id)}
          aria-label={`${u.isActive ? "تعطيل" : "تفعيل"} ${u.username}`}
        />
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">إجراءات</span>,
      className: "w-12 pe-2",
      cell: (u) => <UserActionsMenu user={u} {...actions} />,
    },
  ];

  return (
    <AppTable
      data={users}
      columns={columns}
      getRowId={(u) => u.id}
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      errorMessage={errorMessage}
      onRetry={onRetry}
      empty={{
        icon: IconUsers,
        title: "لا يوجد مستخدمون بعد",
        description: "أضف أول كاشير وحدّد له كلمة مرور ليبدأ العمل.",
        action: emptyAction,
      }}
      noResults={{ title: "لا يوجد مستخدمون مطابقون" }}
      isFiltered={isFiltered}
      onClearFilters={onClearFilters}
      onRowClick={(u) => router.push(USER_ROUTES.edit(u.id))}
      rowClassName={(u) => (!u.isActive ? "bg-muted/20" : undefined)}
      pagination={pagination}
    />
  );
}
