import type { GetExpensesParams } from "../api/expenses.api";

export const expenseKeys = {
  all: ["expenses"] as const,
  list: (params: GetExpensesParams) => ["expenses", "list", params] as const,
  summary: ["expenses", "summary"] as const,
};
