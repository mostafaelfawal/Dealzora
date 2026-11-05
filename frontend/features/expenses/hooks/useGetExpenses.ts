import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getExpenses, type GetExpensesParams } from "../api/expenses.api";
import { expenseKeys } from "../config/expenseQueryKeys";

export default function useGetExpenses(params: GetExpensesParams) {
  return useQuery({
    queryKey: expenseKeys.list(params),
    queryFn: () => getExpenses(params),
    placeholderData: keepPreviousData,
  });
}