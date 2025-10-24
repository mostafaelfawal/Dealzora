import ProductTable from "@/features/products/components/ProductTable";
import SearchContainer from "@/features/products/components/SearchContainer";

export default function page() {
  return (
    <>
      <SearchContainer />
      <ProductTable />
    </>
  );
}
