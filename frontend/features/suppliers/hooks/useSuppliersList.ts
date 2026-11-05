"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { showBulkResult, type BulkItem } from "@/lib/bulk";
import { extractErrorMessage } from "@/lib/errors";

import {
  bulkDeactivateSuppliers,
  bulkDeleteSuppliers,
  deleteSupplier,
  toggleSupplierActive,
} from "../api/suppliers.api";
import { supplierKeys } from "../config/supplierQueryKeys";
import {
  DEFAULT_FILTERS,
  EMPTY_SUMMARY,
  isFiltered,
  toListParams,
} from "../lib/supplierList";
import type { Supplier, SupplierFilters } from "../types/supplier";
import useGetSuppliers from "./useGetSuppliers";
import useGetSuppliersSummary from "./useGetSuppliersSummary";

interface ToggleVars {
  id: string;
  version: number;
  /** true = هذا تراجع، فلا نعرض زر تراجع آخر. */
  isUndo?: boolean;
}

/** حالة صفحة الموردين: الفلاتر + القراءة من الـ API + الإجراءات السريعة. */
export function useSuppliersList() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<SupplierFilters>(DEFAULT_FILTERS);

  // البحث يُرسل للسيرفر بعد توقف الكتابة.
  const debouncedQuery = useDebouncedValue(filters.query, 300);
  const params = useMemo(
    () => toListParams({ ...filters, query: debouncedQuery }),
    [filters, debouncedQuery],
  );

  const suppliersQuery = useGetSuppliers(params);
  const summaryQuery = useGetSuppliersSummary();

  const suppliers = useMemo(
    () => suppliersQuery.data?.items ?? [],
    [suppliersQuery.data],
  );
  const total = suppliersQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const page = Math.min(filters.page, pageCount);

  /** أي تغيير في الفلتر أو الترتيب أو حجم الصفحة يرجّعنا للصفحة الأولى. */
  const patchFilters = useCallback(
    (partial: Partial<SupplierFilters>) =>
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
    queryClient.invalidateQueries({ queryKey: supplierKeys.all });

  /* ---------- الإجراءات ---------- */
  const toggleMutation = useMutation({
    mutationFn: ({ id, version }: ToggleVars) =>
      toggleSupplierActive(id, version),
    onSuccess: (updated, vars) => {
      if (vars.isUndo) {
        toast.success("تم التراجع");
        return;
      }
      toast(
        updated.isActive
          ? `فُعّل «${updated.name}»`
          : `عُطّل «${updated.name}»`,
        {
          action: {
            label: "تراجع",
            onClick: () =>
              toggleMutation.mutate({
                id: updated.id,
                version: updated.version,
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
    mutationFn: ({
      id,
      version,
    }: {
      id: string;
      version: number;
      name: string;
    }) => deleteSupplier(id, version),
    onSuccess: (_data, vars) => {
      toast.success(`حُذف «${vars.name}»`);
      // لو كان هذا آخر مورد في الصفحة، ارجع صفحة للخلف.
      if (suppliers.length === 1 && filters.page > 1) {
        setFilters((current) => ({ ...current, page: current.page - 1 }));
      }
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
    onSettled: refresh,
  });

  const toItems = (rows: Supplier[]): BulkItem[] =>
    rows.map((s) => ({ id: s.id, version: s.version }));

  const bulkDeleteMutation = useMutation({
    mutationFn: (rows: Supplier[]) => bulkDeleteSuppliers(toItems(rows)),
    onSuccess: (result) => {
      showBulkResult(result, "تم حذف", "مورد");
      if (result.succeeded.length >= suppliers.length && filters.page > 1) {
        setFilters((current) => ({ ...current, page: current.page - 1 }));
      }
    },
    onError: (error) => toast.error(extractErrorMessage(error, "تعذّر الحذف")),
    onSettled: refresh,
  });

  const bulkDeactivateMutation = useMutation({
    mutationFn: (rows: Supplier[]) => bulkDeactivateSuppliers(toItems(rows)),
    onSuccess: (result) => showBulkResult(result, "تم تعطيل", "مورد"),
    onError: (error) =>
      toast.error(extractErrorMessage(error, "تعذّر التعطيل")),
    onSettled: refresh,
  });

  const find = (id: string): Supplier | undefined =>
    suppliers.find((s) => s.id === id);

  const toggleActive = (id: string) => {
    const target = find(id);
    if (target) toggleMutation.mutate({ id, version: target.version });
  };

  const remove = (id: string) => {
    const target = find(id);
    if (target)
      removeMutation.mutate({
        id,
        version: target.version,
        name: target.name,
      });
  };

  return {
    suppliers,
    find,
    total,
    page,
    pageCount,
    summary: summaryQuery.data ?? EMPTY_SUMMARY,
    filters,
    filtered: isFiltered(filters),
    isPending: suppliersQuery.isPending,
    isFetching: suppliersQuery.isFetching,
    isError: suppliersQuery.isError,
    error: suppliersQuery.error,
    refetch: suppliersQuery.refetch,
    patchFilters,
    clearFilters,
    toggleActive,
    remove,
    bulkPending:
      bulkDeleteMutation.isPending || bulkDeactivateMutation.isPending,
    bulkRemove: (rows: Supplier[], clear: () => void) =>
      bulkDeleteMutation.mutate(rows, { onSuccess: clear }),
    bulkDeactivate: (rows: Supplier[], clear: () => void) =>
      bulkDeactivateMutation.mutate(rows, { onSuccess: clear }),
  };
}
