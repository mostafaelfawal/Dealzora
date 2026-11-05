export interface SupplierDto {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  balance: number; // قروش
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface SupplierListDto {
  items: SupplierDto[];
  total: number;
  page: number;
  page_size: number;
}

export interface SuppliersSummaryDto {
  total: number;
  owed: number;
  inactive: number;
  total_payable: number; // قروش
}

export interface SupplierTransactionDto {
  id: string;
  supplier_id: string;
  txn_type: "opening" | "purchase" | "purchase_return" | "payment" | "adjustment";
  amount_delta: number; // قروش، موقّعة
  balance_after: number; // قروش
  note: string | null;
  created_at: string;
}

export interface SupplierStatementDto {
  items: SupplierTransactionDto[];
  total: number;
  page: number;
  page_size: number;
}

interface SupplierPayloadBase {
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface SupplierCreatePayload extends SupplierPayloadBase {
  opening_balance: number; // قروش
}

export interface SupplierUpdatePayload extends SupplierPayloadBase {
  base_version: number;
}

export interface SupplierPaymentPayload {
  amount: number; // قروش، أكبر من صفر
  note: string | null;
}
