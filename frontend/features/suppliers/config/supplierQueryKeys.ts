import type { GetSuppliersParams } from "../api/suppliers.api";

export const supplierKeys = {
  all: ["suppliers"] as const,
  list: (params: GetSuppliersParams) => ["suppliers", "list", params] as const,
  summary: ["suppliers", "summary"] as const,
  detail: (id: string) => ["suppliers", "detail", id] as const,
  statement: (id: string, page: number, pageSize: number) =>
    ["suppliers", "statement", id, page, pageSize] as const,
};
