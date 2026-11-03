import type { Metadata } from "next";

import { ProductFormScreen } from "@/features/products/components/productFormScreen";
import ProductFormContextProvider from "@/features/products/context/ProductFormContext";

export const metadata: Metadata = { title: "صنف جديد" };

export default function NewProductPage() {
  return (
    <ProductFormContextProvider>
      <ProductFormScreen />
    </ProductFormContextProvider>
  );
}
