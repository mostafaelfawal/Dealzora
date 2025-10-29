"use client";

import { useEffect, useState } from "react";
import ProductRow from "./ProductRow";
import ProductPagination from "./ProductPagination";
import useFetchProducts from "../../hooks/CRUD/useFetchProducts";
import Image from "next/image";
import toast from "react-hot-toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { motion } from "framer-motion";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

export default function ProductTable() {
  const { products, error, loading } = useFetchProducts();

  const isSearch = useSelector((state: RootState) => state.search.searchQuery);
  const isCategorie = useSelector(
    (state: RootState) => state.search.categoriesQuery
  );
  const isState = useSelector((state: RootState) => state.search.stateQuery);
  const isSearchActive = isSearch || isCategorie || isState;

  useEffect(() => {
    if (error) {
      toast.dismiss();
      toast.error(error);
    }
  }, [error]);

  const [openRow, setOpenRow] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const productsPerPage = 5;

  useEffect(() => {
    setCurrentPage(1);
  }, [products.length]);

  const totalPages = Math.ceil(products.length / productsPerPage);
  const indexOfLast = currentPage * productsPerPage;
  const indexOfFirst = indexOfLast - productsPerPage;
  const currentProducts = products.slice(indexOfFirst, indexOfLast);

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow-md p-4">
      <table className="w-full text-right">
        <thead className="bg-linear-to-r from-blue-500 to-blue-700 text-white text-sm">
          <tr>
            <th className="py-3 px-4">اسم المنتج</th>
            <th className="hidden md:table-cell py-3 px-4">السعر</th>
            <th className="hidden md:table-cell py-3 px-4">الفئة</th>
            <th className="hidden md:table-cell py-3 px-4">المخزون</th>
            <th className="hidden md:table-cell py-3 px-4">الحالة</th>
            <th className="hidden md:table-cell py-3 px-4">تفاعل</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} className="text-center p-4">
                <LoadingSpinner />
                <p className="animate-pulse">جاري تحميل منتجات...</p>
              </td>
            </tr>
          ) : products.length ? (
            currentProducts.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                openRow={openRow}
                setOpenRow={setOpenRow}
              />
            ))
          ) : (
            <tr>
              <td colSpan={6} className="text-center p-4">
                <motion.div
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="mb-3 relative w-full h-50"
                >
                  {isSearchActive ? (
                    <Image
                      src="/search not-found.svg"
                      alt="not-found search"
                      fill
                      className="select-none"
                    />
                  ) : (
                    <Image
                      src="/products-undefined.svg"
                      alt="not-found products"
                      fill
                      className="select-none"
                    />
                  )}
                </motion.div>
                <p className="mb-1 font-semibold">
                  {isSearchActive
                    ? "لم يتم العثور على المنتج"
                    : "لم تضف أي منتجات بعد."}
                </p>
                <p className="text-gray-500">
                  {isSearchActive
                    ? `"${isSearch ? isSearch : "غير موجود"}"`
                    : "أضف أول منتج لك"}
                </p>
              </td>
            </tr>
          )}
        </tbody>

        <tfoot>
          <tr>
            <td colSpan={6}>
              <ProductPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalProducts={products.length}
                indexOfFirst={indexOfFirst}
                indexOfLast={indexOfLast}
                handlePageChange={setCurrentPage}
              />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
