"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import {
  DEFAULT_FILTERS,
  EMPTY_SUMMARY,
  isFiltered,
  toListParams,
} from "../lib/expenseList";
import type { Expense, ExpenseFilters } from "../types/expense";
import useGetExpenses from "./useGetExpenses";
import useGetExpensesSummary from "./useGetExpensesSummary";

/** حالة صفحة المصاريف: الفلاتر + القراءة من الـ API. */
export function useExpensesList() {
  const [filters, setFilters] = useState<ExpenseFilters>(DEFAULT_FILTERS);

  // البحث يُرسل للسيرفر بعد توقف الكتابة.
  const debouncedQuery = useDebouncedValue(filters.query, 300);
  const params = useMemo(
    () => toListParams({ ...filters, query: debouncedQuery }),
    [filters, debouncedQuery],
  );

  const expensesQuery = useGetExpenses(params);
  const summaryQuery = useGetExpensesSummary();

  const expenses = useMemo<Expense[]>(
    () => expensesQuery.data?.items ?? [],
    [expensesQuery.data],
  );
  const total = expensesQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const page = Math.min(filters.page, pageCount);

  // لو الصفحة الحالية فضيت (بعد حذف مثلاً) ارجع لآخر صفحة موجودة.
  useEffect(() => {
    if (!expensesQuery.isFetching && total > 0 && filters.page > pageCount) {
      setFilters((current) => ({ ...current, page: pageCount }));
    }
  }, [expensesQuery.isFetching, total, filters.page, pageCount]);

  /** أي تغيير في الفلتر أو الترتيب أو حجم الصفحة يرجّعنا للصفحة الأولى. */
  const patchFilters = useCallback(
    (partial: Partial<ExpenseFilters>) =>
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

  return {
    expenses,
    total,
    page,
    summary: summaryQuery.data ?? EMPTY_SUMMARY,
    filters,
    filtered: isFiltered(filters),
    isPending: expensesQuery.isPending,
    isFetching: expensesQuery.isFetching,
    isError: expensesQuery.isError,
    error: expensesQuery.error,
    refetch: expensesQuery.refetch,
    patchFilters,
    clearFilters,
  };
}