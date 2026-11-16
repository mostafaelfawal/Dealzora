import type { TaxMode } from "@/lib/tax";

import type { EReceiptStatus, PaymentMethod, ReturnReason } from "./sale";

export interface EtaPrintDto {
  uuid: string;
  receipt_number: string;
  rin: string;
  trade_name: string;
  branch_code: string;
  device_serial: string;
  issued_at: string;
  qr_content: string;
  qr_url: string;
  qr_modules: string[];
  reference_uuid?: string | null;
}

/** شكل الـ backend كما هو (قروش، كميات × 1000). */
export interface SaleLineDto {
  id: string;
  product_id: string;
  unit_id: string | null;
  name: string;
  unit_name: string;
  factor: number;
  qty: number;
  unit_price: number;
  discount: number;
  promo_discount?: number;
  promo_name?: string | null;
  is_wholesale?: boolean;
  line_total: number;
  net_total: number;
  tax_rate?: number | null; // نقاط أساس
  tax_amount?: number | null;
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
  payment_label?: string;
  subtotal: number;
  lines_discount: number;
  promo_discount?: number;
  loyalty_redeemed?: number;
  loyalty_discount?: number;
  loyalty_earned?: number;
  tax_mode?: TaxMode | null;
  taxable_total?: number | null;
  tax_total?: number | null;
  eta_status?: EReceiptStatus | null;
  eta_uuid?: string | null;
  eta_receipt_number?: string | null;
  eta_error?: string | null;
  eta_print?: EtaPrintDto | null;
  customer_points?: number | null;
  customer_balance?: number | null;
  change_kept?: number;
  balance_used?: number;
  invoice_discount: number;
  total: number;
  cash_amount: number;
  credit_amount: number;
  wallet_amount: number;
  payment_ref: string | null;
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
  tax_amount?: number | null;
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
  wallet_refund: number;
  balance_refund?: number;
  tax_total?: number | null;
  eta_uuid?: string | null;
  eta_print?: EtaPrintDto | null;
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
