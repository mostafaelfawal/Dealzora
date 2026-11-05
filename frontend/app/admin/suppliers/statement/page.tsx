import { Suspense } from "react";

import { SupplierStatementScreen } from "@/features/suppliers/components/supplierStatementScreen";

import { Metadata } from "next";

export const metadata: Metadata = { title: "كشف حساب مورد" };

export default function SupplierStatementPage() {
  return (
    <Suspense>
      <SupplierStatementScreen />
    </Suspense>
  );
}
