import type { Metadata } from "next";

import { ProductFormScreen } from "@/features/products/components/productFormScreen";

export const metadata: Metadata = { title: "تعديل صنف" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductFormScreen productId={id} />;
}
