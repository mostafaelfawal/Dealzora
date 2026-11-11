import { Suspense } from "react";

import SupplierFormContextProvider from "@/features/suppliers/context/SupplierFormContext";
import { SupplierFormScreen } from "@/features/suppliers/components/supplierFormScreen";
import { Metadata } from "next";
import { PlanGate } from "@/components/shared/PlanGate";

export const metadata: Metadata = { title: "تعديل مورد" };

export default function EditSupplierPage() {
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
