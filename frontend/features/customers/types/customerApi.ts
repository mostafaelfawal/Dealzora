import type { CreditLevel, StatementEntryType } from "./customer";

/** شكل الاستجابة كما يرجعها الـ backend (المال بالقروش، التواريخ ISO). */
export interface CustomerDto {
  id: string;
  name: string;
  phone: string | null;
  address: string;
  notes: string | null; // null للكاشير
  balance: number;
  credit_limit: number;
  available_credit: number;
  credit_level: CreditLevel;
  is_overdue: boolean;
  is_active: boolean;
  total_sales: number | null; // null للكاشير
  last_purchase_at: string | null;
  last_payment_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerListDto {
  items: CustomerDto[];
  total: number;
  page: number;
  page_size: number;
}

export interface StatementEntryDto {
  id: string;
  entry_type: StatementEntryType;
  debit: number;
  credit: number;
  balance_after: number;
  note: string | null;
  ref_type: string | null;
  ref_id: string | null;
  created_at: string;
}

export interface StatementDto {
  items: StatementEntryDto[]; // الأحدث أولاً
  total: number;
  page: number;
  page_size: number;
}

export interface CustomerCreatePayload {
  name: string;
  phone: string;
  address: string;
  notes: string;
  credit_limit: number;
  opening_balance: number;
  is_active: boolean;
}

export type CustomerUpdatePayload = Omit<CustomerCreatePayload, "opening_balance"> & {
  base_version: number;
};

export interface PaymentPayload {
  amount: number;
  note: string | null;
}