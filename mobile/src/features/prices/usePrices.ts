/** أسعار الأصناف المشتركة (المالك فقط): بحث وتعديل، والتعارض بالـ version من الخادم. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

import { api } from "@/api/instance";
import { ApiError, errorMessage } from "@/api/errors";
import type { CatalogProduct } from "@/api/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export function useCatalogSearch(text: string, enabled: boolean) {
  const q = useDebouncedValue(text.trim(), 350);
  return useQuery({
    queryKey: ["prices", "search", q],
    queryFn: ({ signal }) =>
      api.get<CatalogProduct[]>(
        `/admin/catalog/search?q=${encodeURIComponent(q)}`,
        signal,
      ),
    enabled: enabled && q.length >= 2,
    staleTime: 10_000,
  });
}

export function useUpdatePrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      p: CatalogProduct;
      sale_price: number;
      wholesale_price: number | null;
    }) =>
      api.post<CatalogProduct>(
        `/admin/catalog/${encodeURIComponent(v.p.gid)}/price`,
        {
          version: v.p.version,
          sale_price: v.sale_price,
          wholesale_price: v.wholesale_price,
        },
      ),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["prices", "search"] }),
    onError: (e) => {
      if (e instanceof ApiError && e.code === "catalog_changed") {
        void qc.invalidateQueries({ queryKey: ["prices", "search"] });
        Alert.alert(
          "تعدّل الصنف من فرع آخر",
          `${e.message}. تم تحديث البيانات بالسعر الحالي.`,
        );
        return;
      }
      Alert.alert("لم يُحفظ السعر", errorMessage(e));
    },
  });
}
