"use client";

import { IconBuildingStore } from "@tabler/icons-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { extractErrorMessage } from "@/lib/errors";

import { SUPPLIER_ROUTES } from "../config/supplierRoutes";
import { useSupplierFormContext } from "../context/SupplierFormContext";
import { SupplierForm } from "./supplierForm";

export function SupplierFormScreen() {
  const { supplierId, supplierData } = useSupplierFormContext();
  const { data: supplier, isPending, isError, error } = supplierData;

  if (!supplierId) return <SupplierForm />;

  if (isPending) {
    return (
      <p className="py-24 text-center text-sm text-muted-foreground">
        جارٍ تحميل المورد…
      </p>
    );
  }

  if (isError || !supplier) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-24 text-center">
        <IconBuildingStore className="size-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">لم نجد هذا المورد</p>
          <p className="text-xs text-muted-foreground">
            {extractErrorMessage(error, "ربما حُذف أو الرابط غير صحيح.")}
          </p>
        </div>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={SUPPLIER_ROUTES.list} />}
        >
          رجوع إلى الموردين
        </Button>
      </div>
    );
  }

  return <SupplierForm />;
}
