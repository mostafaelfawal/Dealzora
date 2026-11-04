import type { Metadata } from "next";

import { ProductsScreen } from "@/features/products/components/productsScreen";

export const metadata: Metadata = { title: "المنتجات" };

export default function ProductsPage() {
  return <ProductsScreen />;
}
