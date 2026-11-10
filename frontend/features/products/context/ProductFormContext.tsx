"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { UseQueryResult } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";

import { PRODUCT_FIELD_IDS } from "../config/productFormFields";
import { PRODUCT_ROUTES } from "../config/productRoutes";
import useCreateProduct from "../hooks/useCreateProduct";
import useGetProduct from "../hooks/useGetProduct";
import useUpdateProduct from "../hooks/useUpdateProduct";
import { emptyValues, toFormValues } from "../lib/productForm";
import {
  productSchema,
  type ProductSchemaType,
} from "../schema/product.schema";
import type { Product } from "../types/product";

export type ProductSubmitHandler = (
  values: ProductSchemaType,
  andNew: boolean,
) => void | Promise<void>;

type ProductFormContextType = {
  form: UseFormReturn<ProductSchemaType>;
  productId: string | null;
  productData: UseQueryResult<Product, Error>;
  onSubmit: ProductSubmitHandler;
  /** true طول ما طلب الإضافة أو التعديل شغال (من الـ mutation فقط). */
  isSaving: boolean;
};

export const ProductFormContext = createContext<ProductFormContextType | null>(
  null,
);

export default function ProductFormContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get("product_id");
  const productData = useGetProduct(productId);
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();

  const form = useForm<ProductSchemaType>({
    resolver: zodResolver(productSchema),
    defaultValues: emptyValues(),
    shouldFocusError: false,
  });

  const { reset } = form;
  const loaded = productData.data;

  useEffect(() => {
    if (!productId) {
      reset(emptyValues());
      return;
    }
    if (loaded) reset(toFormValues(loaded));
  }, [productId, loaded, reset]);

  // الأخطاء يعرضها toast داخل الـ hooks، فنبلعها هنا حتى لا تصير unhandled.
  const onSubmit: ProductSubmitHandler = async (values, andNew) => {
    try {
      if (productId) {
        if (!loaded) return;
        await updateMutation.mutateAsync({
          id: productId,
          values,
          baseVersion: loaded.version,
        });
        router.push(PRODUCT_ROUTES.list);
        return;
      }

      await createMutation.mutateAsync(values);
      if (andNew) {
        reset(emptyValues());
        document.getElementById(PRODUCT_FIELD_IDS.name)?.focus();
      } else {
        router.push(PRODUCT_ROUTES.list);
      }
    } catch {
      // تم عرض الخطأ في onError.
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <ProductFormContext.Provider
      value={{ form, productData, productId, onSubmit, isSaving }}
    >
      {children}
    </ProductFormContext.Provider>
  );
}

export function useProductFormContext() {
  const context = useContext(ProductFormContext);

  if (!context) {
    throw new Error(
      "useProductFormContext يجب ان تكون بداخل ProductFormContextProvider",
    );
  }
  return context;
}
