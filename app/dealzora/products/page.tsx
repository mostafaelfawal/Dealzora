import ProductTable from "@/features/products/components/Product/ProductTable";
import SearchContainer from "@/features/products/components/SearchContainer";

export default function page() {
  return (
    <>
      <SearchContainer />
      <ProductTable />
    </>
  );
}
