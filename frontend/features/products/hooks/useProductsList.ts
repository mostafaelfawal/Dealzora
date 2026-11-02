"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { extractErrorMessage } from "@/lib/errors";

import {
  deleteProduct,
  duplicateProduct,
  toggleProductActive,
} from "../api/products.api";
import { productKeys } from "../config/productQueryKeys";
import {
  DEFAULT_FILTERS,
  EMPTY_SUMMARY,
  isFiltered,
  toListParams,
} from "../lib/productList";
import type { Product, ProductFilters } from "../types/product";
import useGetProducts from "./useGetProducts";
import useGetProductsSummary from "./useGetProductsSummary";

interface ToggleVars {
  id: string;
  version: number;
  /** true = هذا تراجع، فلا نعرض زر تراجع آخر. */
  isUndo?: boolean;
}

/** حالة صفحة المنتجات: الفلاتر + القراءة من الـ API + الإجراءات السريعة. */
export function useProductsList() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);

  // البحث يُرسل للسيرفر بعد توقف الكتابة.
  const debouncedQuery = useDebouncedValue(filters.query, 300);
  const params = useMemo(
    () => toListParams({ ...filters, query: debouncedQuery }),
    [filters, debouncedQuery],
  );

  const productsQuery = useGetProducts(params);
  const summaryQuery = useGetProductsSummary();

  const products = useMemo(
    () => productsQuery.data?.items ?? [],
    [productsQuery.data],
  );
  const total = productsQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const page = Math.min(filters.page, pageCount);

  /** أي تغيير في الفلتر أو الترتيب أو حجم الصفحة يرجّعنا للصفحة الأولى. */
  const patchFilters = useCallback(
    (partial: Partial<ProductFilters>) =>
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
    queryClient.invalidateQueries({ queryKey: productKeys.all });

  /* ---------- الإجراءات ---------- */
  const toggleMutation = useMutation({
    mutationFn: ({ id, version }: ToggleVars) =>
      toggleProductActive(id, version),
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
          description: updated.isActive
            ? "أصبح متاحاً في الكاشير"
            : "لن يظهر في الكاشير",
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

  const duplicateMutation = useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => duplicateProduct(id),
    onSuccess: (_copy, vars) =>
      toast.success(`تم تكرار «${vars.name}»`, {
        description: "النسخة بدون باركود وبرصيد صفر، عدّلها كما تريد.",
      }),
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
    }) => deleteProduct(id, version),
    onSuccess: (_data, vars) => toast.success(`حُذف «${vars.name}»`),
    onError: (error) => toast.error(extractErrorMessage(error)),
    onSettled: refresh,
  });

  const find = (id: string): Product | undefined =>
    products.find((p) => p.id === id);

  const toggleActive = (id: string) => {
    const target = find(id);
    if (target) toggleMutation.mutate({ id, version: target.version });
  };

  const duplicate = (id: string) => {
    const target = find(id);
    if (target) duplicateMutation.mutate({ id, name: target.name });
  };

  const remove = (id: string) => {
    const target = find(id);
    if (target)
      removeMutation.mutate({ id, version: target.version, name: target.name });
  };

  return {
    products,
    total,
    page,
    pageCount,
    summary: summaryQuery.data ?? EMPTY_SUMMARY,
    filters,
    filtered: isFiltered(filters),
    isPending: productsQuery.isPending,
    isFetching: productsQuery.isFetching,
    isError: productsQuery.isError,
    error: productsQuery.error,
    refetch: productsQuery.refetch,
    patchFilters,
    clearFilters,
    toggleActive,
    duplicate,
    remove,
  };
}
