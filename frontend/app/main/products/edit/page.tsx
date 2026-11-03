import type { Metadata } from "next";

import { ProductFormScreen } from "@/features/products/components/productFormScreen";
import ProductFormContextProvider from "@/features/products/context/ProductFormContext";

export const metadata: Metadata = { title: "تعديل صنف" };

export default async function EditProductPage() {
  return (
    <ProductFormContextProvider>
      <ProductFormScreen />
    </ProductFormContextProvider>
  );
}
