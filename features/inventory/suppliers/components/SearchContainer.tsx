"use client";
import HeaderPage from "@/components/HeaderPage";
import { FaSearch, FaTruck, FaUserPlus } from "react-icons/fa";

export default function SearchContainer() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <HeaderPage title="ادارة الموردين" Icon={FaTruck} />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 items-center">
        {/* Search Input */}
        <div className="relative w-full group">
          <input
            placeholder="ابحث عن مورد..."
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 pl-10 text-gray-700 shadow-sm 
            focus:ring-2 focus:border-none focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 
            hover:shadow-md placeholder:text-gray-400"
          />
          <FaSearch className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-200" />
        </div>

        {/* Add Supplier Button */}
        <button className="flex gap-2 items-center justify-center px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 hover:scale-105 transition-all w-full shadow-sm hover:shadow-md">
          <FaUserPlus />
          اضف مورد
        </button>
      </div>
    </div>
  );
}
