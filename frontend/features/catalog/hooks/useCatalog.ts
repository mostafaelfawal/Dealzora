import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { productKeys } from "@/features/products/config/productQueryKeys";
import { extractErrorMessage } from "@/lib/errors";

import {
  createCategory,
  createUnit,
  deleteCategory,
  deleteUnit,
  getUnits,
  renameCategory,
  updateUnit,
  type UnitInput,
} from "../api/catalog.api";
import { unitKeys } from "../config/catalogQueryKeys";

export function useUnits() {
  return useQuery({
    queryKey: unitKeys.all,
    queryFn: getUnits,
    staleTime: 5 * 60 * 1000,
  });
}

/** أي تعديل في الكتالوج قد يغيّر الأصناف (إعادة تسمية وحدة، حذف قسم). */
function useCatalogMutation<V, R>(
  key: QueryKey,
  fn: (vars: V) => Promise<R>,
  success: (vars: V) => string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_r, vars) => toast.success(success(vars)),
    onError: (error) => toast.error(extractErrorMessage(error)),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: key }),
        qc.invalidateQueries({ queryKey: productKeys.all }),
      ]),
  });
}

/* ---------- الأقسام ---------- */

export const useCreateCategory = () =>
  useCatalogMutation(
    productKeys.categories,
    (name: string) => createCategory(name),
    (name) => `أُضيف القسم «${name}»`,
  );

export const useRenameCategory = () =>
  useCatalogMutation(
    productKeys.categories,
    (v: { id: string; name: string; version: number }) =>
      renameCategory(v.id, v.name, v.version),
    (v) => `حُفظ القسم «${v.name}»`,
  );

export const useDeleteCategory = () =>
  useCatalogMutation(
    productKeys.categories,
    (v: { id: string; name: string; version: number }) =>
      deleteCategory(v.id, v.version),
    (v) => `حُذف القسم «${v.name}»`,
  );

/* ---------- الوحدات ---------- */

export const useCreateUnit = () =>
  useCatalogMutation(
    unitKeys.all,
    (input: UnitInput) => createUnit(input),
    (v) => `أُضيفت الوحدة «${v.name}»`,
  );

export const useUpdateUnit = () =>
  useCatalogMutation(
    unitKeys.all,
    (v: { id: string; input: UnitInput; version: number }) =>
      updateUnit(v.id, v.input, v.version),
    (v) => `حُفظت الوحدة «${v.input.name}»`,
  );

export const useDeleteUnit = () =>
  useCatalogMutation(
    unitKeys.all,
    (v: { id: string; name: string; version: number }) =>
      deleteUnit(v.id, v.version),
    (v) => `حُذفت الوحدة «${v.name}»`,
  );
