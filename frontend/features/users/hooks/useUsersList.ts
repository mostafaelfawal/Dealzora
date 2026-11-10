"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";

import { deleteUser, updateUser } from "../api/users.api";
import { userKeys } from "../config/userQueryKeys";
import {
  applyFilters,
  DEFAULT_FILTERS,
  EMPTY_SUMMARY,
  isFiltered,
  summarize,
} from "../lib/userList";
import type { User, UserFilters } from "../types/user";
import useGetUsers from "./useGetUsers";

interface ToggleVars {
  id: string;
  /** الحالة المطلوبة. */
  isActive: boolean;
  /** true = هذا تراجع، فلا نعرض زر تراجع آخر. */
  isUndo?: boolean;
}

/** حالة صفحة المستخدمين: الفلاتر (محلياً) + القراءة من الـ API + الإجراءات السريعة. */
export function useUsersList() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<UserFilters>(DEFAULT_FILTERS);
  const usersQuery = useGetUsers();

  const allUsers = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const summary = useMemo(
    () => (usersQuery.data ? summarize(allUsers) : EMPTY_SUMMARY),
    [usersQuery.data, allUsers],
  );
  const filteredUsers = useMemo(
    () => applyFilters(allUsers, filters),
    [allUsers, filters],
  );

  const total = filteredUsers.length;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const page = Math.min(filters.page, pageCount);
  const pagedUsers = useMemo(
    () =>
      filteredUsers.slice(
        (page - 1) * filters.pageSize,
        page * filters.pageSize,
      ),
    [filteredUsers, page, filters.pageSize],
  );

  /** أي تغيير في الفلتر أو الترتيب أو حجم الصفحة يرجّعنا للصفحة الأولى. */
  const patchFilters = useCallback(
    (partial: Partial<UserFilters>) =>
      setFilters((current) => ({
        ...current,
        ...partial,
        page: partial.page ?? 1,
      })),
    [],
  );

  const clearFilters = useCallback(
    () =>
      setFilters((current) => ({
        ...DEFAULT_FILTERS,
        sort: current.sort,
        pageSize: current.pageSize,
      })),
    [],
  );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: userKeys.all });

  /* ---------- الإجراءات ---------- */
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: ToggleVars) =>
      updateUser(id, { is_active: isActive }),
    onSuccess: (updated, vars) => {
      if (vars.isUndo) {
        toast.success("تم التراجع");
        return;
      }
      toast(
        updated.isActive
          ? `فُعّل «${updated.username}»`
          : `عُطّل «${updated.username}»`,
        {
          action: {
            label: "تراجع",
            onClick: () =>
              toggleMutation.mutate({
                id: updated.id,
                isActive: !updated.isActive,
                isUndo: true,
              }),
          },
          duration: 4000,
        },
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
    onSettled: refresh,
  });

  const removeMutation = useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => deleteUser(id),
    onSuccess: (_data, vars) => {
      toast.success(`حُذف «${vars.name}»`);
      // لو كان هذا آخر مستخدم في الصفحة، ارجع صفحة للخلف.
      if (pagedUsers.length === 1 && filters.page > 1) {
        setFilters((current) => ({ ...current, page: current.page - 1 }));
      }
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
    onSettled: refresh,
  });

  const find = (id: string): User | undefined =>
    allUsers.find((u) => u.id === id);

  const toggleActive = (id: string) => {
    const target = find(id);
    if (target) toggleMutation.mutate({ id, isActive: !target.isActive });
  };

  const remove = (id: string) => {
    const target = find(id);
    if (target) removeMutation.mutate({ id, name: target.username });
  };

  return {
    users: pagedUsers,
    filteredUsers,
    find,
    total,
    page,
    pageCount,
    summary,
    filters,
    filtered: isFiltered(filters),
    isPending: usersQuery.isPending,
    isFetching: usersQuery.isFetching,
    isError: usersQuery.isError,
    error: usersQuery.error,
    refetch: usersQuery.refetch,
    patchFilters,
    clearFilters,
    toggleActive,
    remove,
    removing: removeMutation.isPending,
  };
}
