import { api } from "@/lib/axios";
import { toBulkPayload, type BulkItem, type BulkResultDto } from "@/lib/bulk";

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

/** أسماء الـ query params كما يتوقعها الـ backend. القيم undefined لا تُرسل. */
export interface GetSuppliersParams {
  q?: string;
  balance?: Exclude<BalanceFilter, "all">;
  sort?: SupplierSortKey;
  page?: number;
  page_size?: number;
}

/** شكل استجابة GET /suppliers (Page[SupplierOut]). */
interface SupplierListDto {
  items: SupplierDto[];
  total: number;
  page: number;
  page_size: number;
}

type StatementDto = Parameters<typeof toStatement>[0];
type SummaryDto = Parameters<typeof toSummary>[0];
type TransactionDto = Parameters<typeof toTransaction>[0];

// GET /suppliers
export const getSuppliers = async (
  params: GetSuppliersParams,
): Promise<SuppliersPage> => {
  const { data } = await api.get<SupplierListDto>("/suppliers", { params });
  return {
    items: data.items.map(toSupplier),
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
  };
};

// GET /suppliers/{id}
export const getSupplier = async (id: string): Promise<Supplier> =>
  toSupplier((await api.get<SupplierDto>(`/suppliers/${id}`)).data);

// GET /suppliers/summary
export const getSuppliersSummary = async (): Promise<SuppliersSummary> =>
  toSummary((await api.get<SummaryDto>("/suppliers/summary")).data);

// POST /suppliers
export const createSupplier = async (
  payload: SupplierCreatePayload,
): Promise<Supplier> =>
  toSupplier((await api.post<SupplierDto>("/suppliers", payload)).data);

// PUT /suppliers/{id}
export const updateSupplier = async (
  id: string,
  payload: SupplierUpdatePayload,
): Promise<Supplier> =>
  toSupplier((await api.put<SupplierDto>(`/suppliers/${id}`, payload)).data);

// POST /suppliers/{id}/toggle-active?base_version=
export const toggleSupplierActive = async (
  id: string,
  baseVersion: number,
): Promise<Supplier> =>
  toSupplier(
    (
      await api.post<SupplierDto>(`/suppliers/${id}/toggle-active`, null, {
        params: { base_version: baseVersion },
      })
    ).data,
  );

// DELETE /suppliers/{id}?base_version=
export const deleteSupplier = async (
  id: string,
  baseVersion: number,
): Promise<void> => {
  await api.delete(`/suppliers/${id}`, {
    params: { base_version: baseVersion },
  });
};

// POST /suppliers/bulk-delete
export const bulkDeleteSuppliers = async (
  items: BulkItem[],
): Promise<BulkResultDto> =>
  (
    await api.post<BulkResultDto>(
      "/suppliers/bulk-delete",
      toBulkPayload(items),
    )
  ).data;

// POST /suppliers/bulk-deactivate
export const bulkDeactivateSuppliers = async (
  items: BulkItem[],
): Promise<BulkResultDto> =>
  (
    await api.post<BulkResultDto>(
      "/suppliers/bulk-deactivate",
      toBulkPayload(items),
    )
  ).data;

// GET /suppliers/{id}/statement?page=&page_size=
export const getSupplierStatement = async (
  id: string,
  params: { page: number; page_size: number },
): Promise<SupplierStatementPage> =>
  toStatement(
    (await api.get<StatementDto>(`/suppliers/${id}/statement`, { params }))
      .data,
  );

// POST /suppliers/{id}/payments
export const createSupplierPayment = async (
  id: string,
  payload: SupplierPaymentPayload,
): Promise<SupplierTransaction> =>
  toTransaction(
    (await api.post<TransactionDto>(`/suppliers/${id}/payments`, payload)).data,
  );
