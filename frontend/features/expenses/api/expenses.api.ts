import { toBulkPayload, type BulkItem, type BulkResultDto } from "@/lib/bulk";
import { api } from "@/lib/axios";

import {
  toCreatePayload,
  toExpense,
  toSummary,
  toUpdatePayload,
} from "../lib/expenseMapper";
import type {
  Expense,
  ExpenseInput,
  ExpensesPage,
  ExpensesSummary,
  ExpenseSortKey,
} from "../types/expense";
import type {
  ExpenseDto,
  ExpenseListDto,
  ExpensesSummaryDto,
} from "../types/expenseApi";

/** أسماء الـ query params كما يتوقعها الـ backend. القيم undefined لا تُرسل. */
export interface GetExpensesParams {
  q?: string;
  category?: string;
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  sort?: ExpenseSortKey;
  page?: number;
  page_size?: number;
}

export const getExpenses = async (
  params: GetExpensesParams,
): Promise<ExpensesPage> => {
  const { data } = await api.get<ExpenseListDto>("/expenses", { params });
  return {
    items: data.items.map(toExpense),
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
  };
};

export const getExpensesSummary = async (): Promise<ExpensesSummary> =>
  toSummary((await api.get<ExpensesSummaryDto>("/expenses/summary")).data);

export const createExpense = async (input: ExpenseInput): Promise<Expense> =>
  toExpense(
    (await api.post<ExpenseDto>("/expenses", toCreatePayload(input))).data,
  );

export const updateExpense = async (
  id: string,
  input: ExpenseInput,
  baseVersion: number,
): Promise<Expense> =>
  toExpense(
    (
      await api.put<ExpenseDto>(
        `/expenses/${id}`,
        toUpdatePayload(input, baseVersion),
      )
    ).data,
  );

export const deleteExpense = async (
  id: string,
  baseVersion: number,
): Promise<void> => {
  await api.delete(`/expenses/${id}`, {
    params: { base_version: baseVersion },
  });
};

export const bulkDeleteExpenses = async (items: BulkItem[]) =>
  (await api.post<BulkResultDto>("/expenses/bulk-delete", toBulkPayload(items)))
    .data;
