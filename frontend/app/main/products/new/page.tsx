import type { Metadata } from "next";

import { ProductFormScreen } from "@/features/products/components/productFormScreen";

export const metadata: Metadata = { title: "صنف جديد" };

export default function NewProductPage() {
  return <ProductFormScreen />;
}
