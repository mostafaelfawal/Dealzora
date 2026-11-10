import { api } from "@/lib/axios";
import { toCategory } from "@/features/products/lib/productMapper";
import type { CategoryDto } from "@/features/products/types/productApi";

import type { MeasureUnit, MeasureUnitDto } from "../types/catalog";

const toUnit = (dto: MeasureUnitDto): MeasureUnit => ({
  id: dto.id,
  name: dto.name,
  allowDecimal: dto.allow_decimal,
  productCount: dto.product_count,
  version: dto.version,
});

/* ---------- الأقسام (القراءة في products.api → getCategories) ---------- */

export const createCategory = async (name: string) =>
  toCategory((await api.post<CategoryDto>("/categories", { name })).data);

export const renameCategory = async (
  id: string,
  name: string,
  baseVersion: number,
) =>
  toCategory(
    (
      await api.put<CategoryDto>(`/categories/${id}`, {
        name,
        base_version: baseVersion,
      })
    ).data,
  );

export const deleteCategory = async (id: string, baseVersion: number) => {
  await api.delete(`/categories/${id}`, {
    params: { base_version: baseVersion },
  });
};

/* ---------- الوحدات ---------- */

export const getUnits = async (): Promise<MeasureUnit[]> =>
  (await api.get<MeasureUnitDto[]>("/units")).data.map(toUnit);

export interface UnitInput {
  name: string;
  allowDecimal: boolean;
}

export const createUnit = async (input: UnitInput) =>
  toUnit(
    (
      await api.post<MeasureUnitDto>("/units", {
        name: input.name,
        allow_decimal: input.allowDecimal,
      })
    ).data,
  );

export const updateUnit = async (
  id: string,
  input: UnitInput,
  baseVersion: number,
) =>
  toUnit(
    (
      await api.put<MeasureUnitDto>(`/units/${id}`, {
        name: input.name,
        allow_decimal: input.allowDecimal,
        base_version: baseVersion,
      })
    ).data,
  );

export const deleteUnit = async (id: string, baseVersion: number) => {
  await api.delete(`/units/${id}`, { params: { base_version: baseVersion } });
};
