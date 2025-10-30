import SearchContainer from "@/features/products/components/SearchContainer";
import dynamic from "next/dynamic";

export default function page() {
  const ProductTable = dynamic(
    () => import("@/features/products/components/Product/ProductTable")
  );
  return (
    <>
      <SearchContainer />
      <ProductTable />
    </>
  );
}
