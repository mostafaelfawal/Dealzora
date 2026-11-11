import { Suspense } from "react";

import { SupplierStatementScreen } from "@/features/suppliers/components/supplierStatementScreen";

import { Metadata } from "next";
import { PlanGate } from "@/components/shared/PlanGate";

export const metadata: Metadata = { title: "كشف حساب مورد" };

export default function SupplierStatementPage() {
  return (
    <PlanGate feature="suppliers">
      <Suspense>
        <SupplierStatementScreen />
      </Suspense>
    </PlanGate>
  );
}
