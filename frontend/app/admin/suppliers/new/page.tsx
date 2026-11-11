import { Suspense } from "react";

import SupplierFormContextProvider from "@/features/suppliers/context/SupplierFormContext";
import { SupplierFormScreen } from "@/features/suppliers/components/supplierFormScreen";
import { Metadata } from "next";
import { PlanGate } from "@/components/shared/PlanGate";

export const metadata: Metadata = { title: "اضافة مورد" };

export default function NewSupplierPage() {
  return (
    <PlanGate feature="suppliers">
      <Suspense>
        <SupplierFormContextProvider>
          <SupplierFormScreen />
        </SupplierFormContextProvider>
      </Suspense>
    </PlanGate>
  );
}
