import type { GetExpensesParams } from "../api/expenses.api";
import { DEFAULT_PAGE_SIZE } from "../config/expenseOptions";
import type {
  ExpenseFilters,
  ExpensePeriod,
  ExpensesSummary,
} from "../types/expense";
import { toYmd } from "./expenseCalc";

export const DEFAULT_FILTERS: ExpenseFilters = {
  query: "",
  category: "all",
  period: "all",
  sort: "newest",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

export const EMPTY_SUMMARY: ExpensesSummary = {
  today: 0,
  week: 0,
  month: 0,
  total: 0,
  count: 0,
};

export const isFiltered = (f: ExpenseFilters) =>
  f.query.trim() !== "" || f.category !== "all" || f.period !== "all";

/** الفترة ← من/إلى (تواريخ محلية). "week" = آخر 7 أيام شامل اليوم. */
function periodRange(period: ExpensePeriod, now = new Date()) {
  if (period === "all") return {};
  const to = toYmd(now);
  if (period === "today") return { date_from: to, date_to: to };
  if (period === "week") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { date_from: toYmd(from), date_to: to };
  }
  return {
    date_from: toYmd(new Date(now.getFullYear(), now.getMonth(), 1)),
    date_to: to,
  };
}

/** يحوّل حالة الفلاتر إلى query params. القيم الافتراضية لا تُرسل. */
export function toListParams(f: ExpenseFilters): GetExpensesParams {
  return {
    q: f.query.trim() || undefined,
    category: f.category === "all" ? undefined : f.category,
    ...periodRange(f.period),
    sort: f.sort,
    page: f.page,
    page_size: f.pageSize,
  };
}
