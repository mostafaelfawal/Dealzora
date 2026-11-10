/** شكل الاستجابة كما يرجعها الـ backend (المال بالقروش). */
export interface ShiftDto {
  id: string;
  cashier_id: string;
  cashier_name: string | null;
  is_open: boolean;
  opened_at: string;
  closed_at: string | null;
  opening_float: number;
  sales_count: number;
  returns_count: number;
  sales_total: number | null;
  cash_sales: number | null;
  credit_sales: number | null;
  cash_refunds: number | null;
  expected_cash: number | null;
  counted_cash: number | null;
  difference: number | null;
  note: string | null;
  version: number;
}

export interface ShiftListDto {
  items: ShiftDto[];
  total: number;
  page: number;
  page_size: number;
}
