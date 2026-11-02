"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { newLocalId } from "../lib/productCalc";
import {
  applyFilters,
  DEFAULT_FILTERS,
  isFiltered,
  summarize,
} from "../lib/productList";
import { PRODUCTS } from "../mocks/productsData";
import type { Product, ProductFilters } from "../types/product";

/**
 * حالة صفحة المنتجات: القائمة والفلاتر والإجراءات السريعة.
 * TODO: استبدل PRODUCTS بقراءة من IndexedDB، وكل إجراء يكتب في الـ outbox.
 * الحذف هنا soft delete مع تراجع، وده نفس سلوك الـ backend (deleted_at).
 */
export function useProductsList() {
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);

  const visible = useMemo(
    () => applyFilters(products, filters),
    [products, filters],
  );
  const summary = useMemo(() => summarize(products), [products]);

  const patchFilters = useCallback(
    (partial: Partial<ProductFilters>) =>
      setFilters((current) => ({ ...current, ...partial })),
    [],
  );

  const clearFilters = useCallback(
    () => setFilters((current) => ({ ...DEFAULT_FILTERS, sort: current.sort })),
    [],
  );

  const toggleActive = useCallback(
    (id: string) => {
      const target = products.find((p) => p.id === id);
      if (!target) return;
      const was = target.isActive;
      const setActive = (isActive: boolean) =>
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isActive } : p)),
        );

      setActive(!was);
      toast(was ? `عُطّل «${target.name}»` : `فُعّل «${target.name}»`, {
        description: was ? "لن يظهر في الكاشير" : "أصبح متاحاً في الكاشير",
        action: { label: "تراجع", onClick: () => setActive(was) },
        duration: 4000,
      });
    },
    [products],
  );

  const remove = useCallback(
    (id: string) => {
      const index = products.findIndex((p) => p.id === id);
      if (index < 0) return;
      const target = products[index];
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast(`حُذف «${target.name}»`, {
        action: {
          label: "تراجع",
          onClick: () =>
            setProducts((prev) => {
              const next = [...prev];
              next.splice(Math.min(index, next.length), 0, target);
              return next;
            }),
        },
        duration: 6000,
      });
    },
    [products],
  );

  const duplicate = useCallback(
    (id: string) => {
      const index = products.findIndex((p) => p.id === id);
      if (index < 0) return;
      const source = products[index];
      const copy: Product = {
        ...source,
        id: newLocalId(),
        name: `${source.name} (نسخة)`,
        barcode: "",
        stock: 0,
        extraUnits: source.extraUnits.map((u) => ({
          ...u,
          id: newLocalId(),
          barcode: "",
        })),
      };
      setProducts((prev) => {
        const next = [...prev];
        next.splice(index + 1, 0, copy);
        return next;
      });
      toast.success(`تم تكرار «${source.name}»`, {
        description: "النسخة بدون باركود وبرصيد صفر، عدّلها كما تريد.",
      });
    },
    [products],
  );

  return {
    products,
    visible,
    summary,
    filters,
    filtered: isFiltered(filters),
    patchFilters,
    clearFilters,
    toggleActive,
    remove,
    duplicate,
  };
}
