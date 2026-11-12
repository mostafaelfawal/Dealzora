"use client";

import { AppTableCardsSkeleton } from "@/components/shared/AppTable/AppTableCards";
import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { useHotkey } from "@/hooks/useHotkey";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

import { PAGE_SIZES, USERS_SEARCH_ID } from "../config/userOptions";
import { USER_ROUTES } from "../config/userRoutes";
import { USERS_SHORTCUTS } from "../config/userShortcuts";
import useCurrentUserId from "../hooks/useCurrentUserId";
import { useUsersList } from "../hooks/useUsersList";
import { useUsersView } from "../hooks/useUsersView";
import type { User } from "../types/user";
import { DeleteUserDialog } from "./deleteUserDialog";
import { ResetPasswordDialog } from "./resetPasswordDialog";
import { UserCard } from "./userCard";
import { UsersEmpty } from "./usersEmpty";
import { UsersStats } from "./usersStats";
import { UsersTable } from "./usersTable";
import { UsersToolbar } from "./usersToolbar";

/** صفحة إدارة المستخدمين (للمدير): إحصائيات سريعة + بحث وفلاتر + بطاقات أو جدول. */
export function UsersScreen() {
  const router = useRouter();
  const list = useUsersList();
  const currentUserId = useCurrentUserId();
  const { view, setView } = useUsersView();
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [removeTarget, setRemoveTarget] = useState<User | null>(null);

  // الاختصارات لا تعمل والنافذة مفتوحة.
  const whenIdle = (fn: () => void) => () => {
    if (!resetTarget && !removeTarget) fn();
  };

  useHotkey(
    USERS_SHORTCUTS.focusSearch.match,
    whenIdle(() => {
      const input = document.getElementById(
        USERS_SEARCH_ID,
      ) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }),
  );
  useHotkey(
    USERS_SHORTCUTS.newUser.match,
    whenIdle(() => router.push(USER_ROUTES.new)),
  );
  useHotkey(
    USERS_SHORTCUTS.toggleView.match,
    whenIdle(() => setView(view === "cards" ? "table" : "cards")),
  );

  const actions = {
    currentUserId,
    onToggleActive: list.toggleActive,
    onResetPassword: (id: string) => setResetTarget(list.find(id) ?? null),
    onRemove: (id: string) => setRemoveTarget(list.find(id) ?? null),
  };

  const emptyAction = (
    <Button
      size="lg"
      nativeButton={false}
      render={<Link href={USER_ROUTES.new} />}
      className="gap-2"
    >
      <IconPlus />
      مستخدم جديد
      <ShortcutBadge className="border-primary-foreground/30 text-primary-foreground/80">
        {USERS_SHORTCUTS.newUser.label}
      </ShortcutBadge>
    </Button>
  );

  function renderBody() {
    // الجدول يعرض التحميل والخطأ والفراغ بنفسه.
    if (view === "table") {
      return (
        <UsersTable
          users={list.users}
          isLoading={list.isPending}
          isFetching={list.isFetching}
          isError={list.isError}
          errorMessage={extractErrorMessage(
            list.error,
            "تعذّر تحميل المستخدمين",
          )}
          onRetry={() => list.refetch()}
          isFiltered={list.filtered}
          onClearFilters={list.clearFilters}
          emptyAction={emptyAction}
          pagination={{
            total: list.total,
            page: list.page,
            pageSize: list.filters.pageSize,
            onPageChange: (page) => list.patchFilters({ page }),
            onPageSizeChange: (pageSize) => list.patchFilters({ pageSize }),
            pageSizes: PAGE_SIZES,
            itemsLabel: "المستخدمين",
          }}
          {...actions}
        />
      );
    }

    if (list.isPending) {
      return (
        <AppTableCardsSkeleton count={Math.min(list.filters.pageSize, 8)} />
      );
    }

    if (list.isError) {
      return (
        <div className="flex flex-col items-center gap-3 border border-dashed py-16 text-center">
          <p role="alert" className="text-sm text-destructive">
            {extractErrorMessage(list.error, "تعذّر تحميل المستخدمين")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => list.refetch()}
          >
            إعادة المحاولة
          </Button>
        </div>
      );
    }

    if (list.filteredUsers.length === 0) {
      return (
        <UsersEmpty
          hasUsers={list.summary.total > 0}
          onClearFilters={list.clearFilters}
        />
      );
    }

    // عدد المستخدمين قليل، فالبطاقات تعرض كل النتائج بدون ترقيم صفحات.
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.filteredUsers.map((user, index) => (
          <UserCard key={user.id} user={user} index={index} {...actions} />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">المستخدمون</h1>
          <p className="text-xs text-muted-foreground">
            أضف الكاشير وحدّد كلمات مرورهم، وعطّل أو احذف من تريد.
          </p>
        </div>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={USER_ROUTES.new} />}
          className="h-10 gap-2"
        >
          <IconPlus className="size-4" />
          مستخدم جديد
          <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
            {USERS_SHORTCUTS.newUser.label}
          </ShortcutBadge>
        </Button>
      </header>

      <UsersStats
        summary={list.summary}
        filters={list.filters}
        onChange={list.patchFilters}
      />

      <UsersToolbar
        filters={list.filters}
        onChange={list.patchFilters}
        view={view}
        onViewChange={setView}
      />

      <p aria-live="polite" className="text-xs text-muted-foreground">
        عرض{" "}
        <bdi dir="ltr" className="font-mono">
          {list.total}
        </bdi>{" "}
        من{" "}
        <bdi dir="ltr" className="font-mono">
          {list.summary.total}
        </bdi>{" "}
        مستخدم
        {list.filtered && (
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={list.clearFilters}
            className="font-normal"
          >
            مسح الفلاتر
          </Button>
        )}
      </p>

      <div
        aria-busy={list.isFetching}
        className={cn(
          "transition-opacity",
          list.isFetching && !list.isPending && "opacity-60",
        )}
      >
        {renderBody()}
      </div>

      <ResetPasswordDialog
        user={resetTarget}
        onClose={() => setResetTarget(null)}
      />
      <DeleteUserDialog
        user={removeTarget}
        isPending={list.removing}
        onConfirm={(user) => {
          list.remove(user.id);
          setRemoveTarget(null);
        }}
        onClose={() => setRemoveTarget(null)}
      />
    </div>
  );
}
