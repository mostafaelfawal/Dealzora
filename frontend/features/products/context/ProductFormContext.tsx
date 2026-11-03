"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { UseQueryResult } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";

import useGetProduct from "../hooks/useGetProduct";
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
  onSubmit: ProductSubmitHandler | null;
};

export const ProductFormContext = createContext<ProductFormContextType | null>(
  null,
);

export default function ProductFormContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const productId = searchParams.get("product_id");
  const productData = useGetProduct(productId);
  const onSubmit: ProductSubmitHandler | null = null;

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

  return (
    <ProductFormContext.Provider
      value={{ form, productData, productId, onSubmit }}
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
