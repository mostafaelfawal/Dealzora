import { useQuery } from "@tanstack/react-query";

import { getExpensesSummary } from "../api/expenses.api";
import { expenseKeys } from "../config/expenseQueryKeys";

export default function useGetExpensesSummary() {
  return useQuery({
    queryKey: expenseKeys.summary,
    queryFn: getExpensesSummary,
  });
}