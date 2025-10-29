"use client";
import {
  FaPlus,
  FaSearch,
  FaFileExcel,
  FaFilePdf,
  FaShoppingBag,
} from "react-icons/fa";
import { useEffect, useState } from "react";
import AddProductModal from "./AddProductModal/AddProductModal";
import toast from "react-hot-toast";
import useFetchCategories from "../hooks/useFetchCategories";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import {
  setSearchQuery,
  setcategoriesQuery,
  setStateQuery,
} from "@/store/searchProductSlice";
import { exportToExcel } from "../utils/exportToExcel";
import { exportToPDF } from "../utils/exportToPDF";
import HeaderPage from "@/components/HeaderPage";

export default function SearchContainer() {
  const [modalIsOpen, setModalIsOpen] = useState<boolean>(false);
  const { categories, error } = useFetchCategories();
  const products = useSelector((state: RootState) => state.products.items);
  const dispatch = useDispatch<AppDispatch>();
  const categoryValue = useSelector(
    (state: RootState) => state.search.categoriesQuery
  );
  const stateValue = useSelector((state: RootState) => state.search.stateQuery);

  useEffect(() => {
    if (error) {
      toast.dismiss();
      toast.error(error);
    }
  }, [error]);

  return (
    <div className=" bg-white rounded-lg shadow-sm p-6 mb-6">
      <HeaderPage title="ادارة المنتجات" Icon={FaShoppingBag} />
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 items-center">
        {/* Search Input */}
        <div className="relative w-full sm:col-span-2 md:col-span-2 lg:col-span-2">
          <input
            onChange={(e) => dispatch(setSearchQuery(e.target.value))}
            placeholder="ابحث عن منتج..."
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 pl-10 text-gray-700 shadow-sm 
            focus:ring-2 focus:border-none focus:ring-blue-500 outline-none transition-all duration-200 
            hover:shadow-md placeholder:text-gray-400"
          />
          <FaSearch className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-200" />
        </div>

        {/* Categories Filter */}
        <div className="w-full">
          <select
            value={categoryValue}
            onChange={(e) => dispatch(setcategoriesQuery(e.target.value))}
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-gray-700 shadow-sm 
            focus:ring-2 focus:border-none focus:ring-blue-500 outline-none transition-all duration-200 
            hover:shadow-md cursor-pointer"
          >
            <option value="">جميع الفئات</option>
            {categories.map((c: string, i: number) => (
              <option key={i} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full">
          <select
            value={stateValue}
            onChange={(e) => dispatch(setStateQuery(e.target.value))}
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-gray-700 shadow-sm 
            focus:ring-2 focus:border-none focus:ring-blue-500 outline-none transition-all duration-200 
            hover:shadow-md cursor-pointer"
          >
            <option value="">جميع الحالات</option>
            <option value="موجود" className="text-green-600 font-semibold">
              🟢 موجود
            </option>
            <option value="قليل" className="text-yellow-600 font-semibold">
              🟡 قليل
            </option>
            <option value="منتهي" className="text-red-600 font-semibold">
              🔴 منتهي
            </option>
          </select>
        </div>

        {/* Add Product Button */}
        <button
          onClick={() => setModalIsOpen(true)}
          className="flex gap-2 items-center justify-center px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 hover:scale-105 transition-all w-full shadow-sm hover:shadow-md"
        >
          <FaPlus />
          اضف منتج
        </button>

        {/* Export Buttons */}
        <div className="flex gap-2 col-span-2 md:col-span-2 lg:col-span-2">
          <button
            onClick={() => exportToExcel(products)}
            className="flex-1 flex gap-2 items-center justify-center px-4 py-2 text-white bg-green-500 rounded-lg hover:bg-green-600 hover:scale-105 transition-all shadow-sm hover:shadow-md"
          >
            <FaFileExcel />
            Excel
          </button>
          <button
            onClick={() => exportToPDF(products)}
            className="flex-1 flex gap-2 items-center justify-center px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 hover:scale-105 transition-all shadow-sm hover:shadow-md"
          >
            <FaFilePdf />
            PDF
          </button>
        </div>

        {modalIsOpen && (
          <AddProductModal closeModal={() => setModalIsOpen(false)} />
        )}
      </div>
    </div>
  );
}
