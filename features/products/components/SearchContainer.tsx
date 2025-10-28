"use client";
import { FaPlus, FaSearch } from "react-icons/fa";
import { useEffect, useState } from "react";
import AddProductModal from "./AddProductModal/AddProductModal";
import toast from "react-hot-toast";
import useFetchCategories from "../hooks/useFetchCategories";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/store/store";
import { setSearchQuery } from "@/store/productSearch/searchProductSlice";

export default function SearchContainer() {
  const [category, setCategory] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [modalIsOpen, setModalIsOpen] = useState<boolean>(false);
  const { categories, error } = useFetchCategories();
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    if (error) {
      toast.dismiss();
      toast.error(error);
    }
  }, [error]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 items-center bg-white rounded-lg shadow-sm p-6 mb-6">
      {/* Search Input */}
      <div className="relative w-full group">
        <input
          onChange={(e) => dispatch(setSearchQuery(e.target.value))}
          placeholder="ابحث عن منتج..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-shadow hover:shadow-md"
        />
        <FaSearch className="absolute top-1/2 left-3 transform -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-500" />
      </div>

      {/* Category Filter */}
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow hover:shadow-md cursor-pointer w-full"
      >
        <option value="">جميع الفئات</option>
        {categories.map((c, i) => (
          <option key={i} value={c}>
            {c}
          </option>
        ))}
      </select>

      {/* Status Filter */}
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow hover:shadow-md cursor-pointer w-full"
      >
        <option value="">جميع الحالات</option>
        <option value="موجود">موجود</option>
        <option value="منتهي">منتهي</option>
        <option value="قليل">قليل</option>
      </select>

      {/* Add Product Button */}
      <button
        onClick={() => setModalIsOpen(true)}
        className="flex gap-2 items-center justify-center px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 hover:scale-105 transition-all w-full shadow-sm hover:shadow-md"
      >
        <FaPlus />
        اضف منتج
      </button>
      {modalIsOpen && (
        <AddProductModal closeModal={() => setModalIsOpen(false)} />
      )}
    </div>
  );
}
