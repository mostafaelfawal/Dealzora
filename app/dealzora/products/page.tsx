import HeaderPage from "@/components/HeaderPage";
import ProductTable from "@/features/products/components/Product/ProductTable";
import SearchContainer from "@/features/products/components/SearchContainer";
import { FaShoppingBag } from "react-icons/fa";

export default function page() {
  return (
    <>
      <HeaderPage title="ادارة المنتجات" Icon={FaShoppingBag} />
      <SearchContainer />
      <ProductTable />
    </>
  );
}
