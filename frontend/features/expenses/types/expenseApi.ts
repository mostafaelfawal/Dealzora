/** شكل الاستجابة المتوقع من الـ backend (المال بالقروش). عدّله لو اختلف. */
export interface ExpenseDto {
  id: string;
  category: string;
  amount: number;
  note: string | null;
  spent_at: string; // YYYY-MM-DD
  created_by_name: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ExpenseListDto {
  items: ExpenseDto[];
  total: number;
  page: number;
  page_size: number;
}

export interface ExpensesSummaryDto {
  today: number;
  week: number;
  month: number;
  total: number;
  count: number;
}

export interface ExpenseCreatePayload {
  category: string;
  amount: number; // قروش
  note: string | null;
  spent_at: string;
}

export interface ExpenseUpdatePayload extends ExpenseCreatePayload {
  base_version: number;
}