import { Suspense } from "react";

import SupplierFormContextProvider from "@/features/suppliers/context/SupplierFormContext";
import { SupplierFormScreen } from "@/features/suppliers/components/supplierFormScreen";
import { Metadata } from "next";

export const metadata: Metadata = { title: "اضافة مورد" };

export default function NewSupplierPage() {
  return (
    <Suspense>
      <SupplierFormContextProvider>
        <SupplierFormScreen />
      </SupplierFormContextProvider>
    </Suspense>
  );
}
