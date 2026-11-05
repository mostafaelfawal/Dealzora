import { BulkItem, BulkResultDto, toBulkPayload } from "@/lib/bulk";

import {
  toStatement,
  toSummary,
  toSupplier,
  toTransaction,
} from "../lib/supplierMapper";
import type {
  BalanceFilter,
  Supplier,
  SupplierSortKey,
  SupplierStatementPage,
  SuppliersPage,
  SuppliersSummary,
  SupplierTransaction,
} from "../types/supplier";
import type {
  SupplierCreatePayload,
  SupplierDto,
  SupplierPaymentPayload,
  SupplierUpdatePayload,
} from "../types/supplierApi";

/**
 * ⚠️ API مؤقت: كل دالة تطبع اسم الإجراء ومدخلاته في الـ console وترجع قيمة فارغة.
 * عند ربط الـ backend استبدل كل دالة بـ api.get / api.post (انظر المسارات في التعليقات).
 */
const log = (action: string, payload?: unknown) =>
  console.log(`[suppliers] ${action}`, payload ?? "");

/** أسماء الـ query params كما يتوقعها الـ backend. القيم undefined لا تُرسل. */
export interface GetSuppliersParams {
  q?: string;
  balance?: Exclude<BalanceFilter, "all">;
  sort?: SupplierSortKey;
  page?: number;
  page_size?: number;
}

const emptyDto = (id: string): SupplierDto => ({
  id,
  name: "",
  phone: null,
  address: null,
  notes: null,
  balance: 0,
  is_active: true,
  version: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

// GET /suppliers
export const getSuppliers = async (
  params: GetSuppliersParams,
): Promise<SuppliersPage> => {
  log("getSuppliers", params);
  return {
    items: [],
    total: 0,
    page: params.page ?? 1,
    pageSize: params.page_size ?? 24,
  };
};

// GET /suppliers/{id}
export const getSupplier = async (id: string): Promise<Supplier> => {
  log("getSupplier", { id });
  return toSupplier(emptyDto(id));
};

// GET /suppliers/summary
export const getSuppliersSummary = async (): Promise<SuppliersSummary> => {
  log("getSuppliersSummary");
  return toSummary({ total: 0, owed: 0, inactive: 0, total_payable: 0 });
};

// POST /suppliers
export const createSupplier = async (
  payload: SupplierCreatePayload,
): Promise<Supplier> => {
  log("createSupplier", payload);
  return toSupplier({
    ...emptyDto("stub"),
    name: payload.name,
    phone: payload.phone,
    address: payload.address,
    notes: payload.notes,
    balance: payload.opening_balance,
    is_active: payload.is_active,
  });
};

// PUT /suppliers/{id}
export const updateSupplier = async (
  id: string,
  payload: SupplierUpdatePayload,
): Promise<Supplier> => {
  log("updateSupplier", { id, payload });
  return toSupplier({
    ...emptyDto(id),
    name: payload.name,
    phone: payload.phone,
    address: payload.address,
    notes: payload.notes,
    is_active: payload.is_active,
    version: payload.base_version + 1,
  });
};

// POST /suppliers/{id}/toggle-active?base_version=
export const toggleSupplierActive = async (
  id: string,
  baseVersion: number,
): Promise<Supplier> => {
  log("toggleSupplierActive", { id, baseVersion });
  return toSupplier({ ...emptyDto(id), version: baseVersion + 1 });
};

// DELETE /suppliers/{id}?base_version=
export const deleteSupplier = async (
  id: string,
  baseVersion: number,
): Promise<void> => {
  log("deleteSupplier", { id, baseVersion });
};

// POST /suppliers/bulk-delete
export const bulkDeleteSuppliers = async (
  items: BulkItem[],
): Promise<BulkResultDto> => {
  log("bulkDeleteSuppliers", toBulkPayload(items));
  return { succeeded: [], failed: [] };
};

// POST /suppliers/bulk-deactivate
export const bulkDeactivateSuppliers = async (
  items: BulkItem[],
): Promise<BulkResultDto> => {
  log("bulkDeactivateSuppliers", toBulkPayload(items));
  return { succeeded: [], failed: [] };
};

// GET /suppliers/{id}/statement?page=&page_size=
export const getSupplierStatement = async (
  id: string,
  params: { page: number; page_size: number },
): Promise<SupplierStatementPage> => {
  log("getSupplierStatement", { id, ...params });
  return toStatement({
    items: [],
    total: 0,
    page: params.page,
    page_size: params.page_size,
  });
};

// POST /suppliers/{id}/payments
export const createSupplierPayment = async (
  id: string,
  payload: SupplierPaymentPayload,
): Promise<SupplierTransaction> => {
  log("createSupplierPayment", { id, payload });
  return toTransaction({
    id: "stub",
    supplier_id: id,
    txn_type: "payment",
    amount_delta: -payload.amount,
    balance_after: 0,
    note: payload.note,
    created_at: new Date().toISOString(),
  });
};
