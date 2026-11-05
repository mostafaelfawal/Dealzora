export interface Expense {
  id: string;
  /** مفتاح النوع من EXPENSE_CATEGORIES. */
  category: string;
  /** بالجنيه. */
  amount: number;
  note: string;
  /** تاريخ المصروف (بداية اليوم) بالـ ms. */
  spentAt: number;
  createdByName: string | null;
  version: number;
}

/** ما يرسله الفورم. spentAt بصيغة YYYY-MM-DD. */
export interface ExpenseInput {
  category: string;
  amount: number;
  note: string;
  spentAt: string;
}

export type ExpensePeriod = "all" | "today" | "week" | "month";
export type ExpenseSortKey = "newest" | "oldest" | "amount_desc" | "amount_asc";
export type ExpensesView = "cards" | "table";

export interface ExpenseFilters {
  query: string;
  /** "all" أو مفتاح النوع. */
  category: string;
  period: ExpensePeriod;
  sort: ExpenseSortKey;
  page: number;
  pageSize: number;
}

export interface ExpensesPage {
  items: Expense[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ExpensesSummary {
  today: number;
  week: number;
  month: number;
  total: number;
  count: number;
}
