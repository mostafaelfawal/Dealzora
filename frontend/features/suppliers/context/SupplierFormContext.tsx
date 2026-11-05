"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { UseQueryResult } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";

import { SUPPLIER_ROUTES } from "../config/supplierRoutes";
import useCreateSupplier from "../hooks/useCreateSupplier";
import useGetSupplier from "../hooks/useGetSupplier";
import useUpdateSupplier from "../hooks/useUpdateSupplier";
import { emptyValues, toFormValues } from "../lib/supplierForm";
import {
  supplierSchema,
  type SupplierSchemaType,
} from "../schema/supplier.schema";
import type { Supplier } from "../types/supplier";

export type SupplierSubmitHandler = (
  values: SupplierSchemaType,
  andNew: boolean,
) => void | Promise<void>;

type SupplierFormContextType = {
  form: UseFormReturn<SupplierSchemaType>;
  supplierId: string | null;
  supplierData: UseQueryResult<Supplier, Error>;
  onSubmit: SupplierSubmitHandler;
  /** true طول ما طلب الإضافة أو التعديل شغال (من الـ mutation فقط). */
  isSaving: boolean;
};

export const SupplierFormContext =
  createContext<SupplierFormContextType | null>(null);

export default function SupplierFormContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplierId = searchParams.get("supplier_id");
  const supplierData = useGetSupplier(supplierId);
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();

  const form = useForm<SupplierSchemaType>({
    resolver: zodResolver(supplierSchema),
    defaultValues: emptyValues(),
    shouldFocusError: false,
  });

  const { reset } = form;
  const loaded = supplierData.data;

  useEffect(() => {
    if (!supplierId) {
      reset(emptyValues());
      return;
    }
    if (loaded) reset(toFormValues(loaded));
  }, [supplierId, loaded, reset]);

  // الأخطاء يعرضها toast داخل الـ hooks، فنبلعها هنا حتى لا تصير unhandled.
  const onSubmit: SupplierSubmitHandler = async (values, andNew) => {
    try {
      if (supplierId) {
        if (!loaded) return;
        await updateMutation.mutateAsync({
          id: supplierId,
          values,
          baseVersion: loaded.version,
        });
        router.push(SUPPLIER_ROUTES.list);
        return;
      }

      await createMutation.mutateAsync(values);
      if (andNew) {
        reset(emptyValues());
        document.getElementById("sf-name")?.focus();
      } else {
        router.push(SUPPLIER_ROUTES.list);
      }
    } catch {
      // تم عرض الخطأ في onError.
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <SupplierFormContext.Provider
      value={{ form, supplierData, supplierId, onSubmit, isSaving }}
    >
      {children}
    </SupplierFormContext.Provider>
  );
}

export function useSupplierFormContext() {
  const context = useContext(SupplierFormContext);

  if (!context) {
    throw new Error(
      "useSupplierFormContext يجب ان تكون بداخل SupplierFormContextProvider",
    );
  }
  return context;
}
