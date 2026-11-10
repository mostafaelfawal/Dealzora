import type { PaymentMethod, ReturnReason } from "./sale";

/** شكل الـ backend كما هو (قروش، كميات × 1000). */
export interface SaleLineDto {
  id: string;
  product_id: string;
  name: string;
  unit_name: string;
  qty: number;
  unit_price: number;
  discount: number;
  line_total: number;
  net_total: number;
  returned_qty: number;
  unit_cost: number | null;
}

export interface SaleDto {
  id: string;
  number: number;
  sold_at: string;
  sold_on: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  cashier_name: string | null;
  payment_method: PaymentMethod;
  subtotal: number;
  lines_discount: number;
  invoice_discount: number;
  total: number;
  cash_amount: number;
  credit_amount: number;
  received: number;
  change: number;
  returned_total: number;
  cost_total: number | null;
  profit: number | null;
  note: string | null;
  lines: SaleLineDto[];
}

export interface SaleListDto {
  items: SaleDto[];
  total: number;
  page: number;
  page_size: number;
}

export interface ReturnLineDto {
  id: string;
  sale_line_id: string;
  product_id: string;
  name: string;
  unit_name: string;
  qty: number;
  amount: number;
}

export interface ReturnDto {
  id: string;
  number: number;
  sale_id: string;
  sale_number: number;
  returned_at: string;
  returned_on: string;
  reason: ReturnReason;
  note: string | null;
  customer_name: string | null;
  cashier_name: string | null;
  total: number;
  cash_refund: number;
  credit_refund: number;
  lines: ReturnLineDto[];
}

export interface ReturnListDto {
  items: ReturnDto[];
  total: number;
  page: number;
  page_size: number;
}

export interface SalesSummaryDto {
  today_count: number;
  today_total: number;
  today_profit: number;
  today_returns: number;
  week_total: number;
  month_total: number;
  month_profit: number;
}

export interface ExchangeDto {
  sale_return: ReturnDto;
  sale: SaleDto | null;
}
