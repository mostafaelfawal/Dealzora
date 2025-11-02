"use client";
import HeaderPage from "@/components/HeaderPage";
import SearchInput from "@/components/SearchInput";
import { FaTruck, FaUserPlus } from "react-icons/fa";
import Link from "next/link";

export default function SearchContainer() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <HeaderPage title="ادارة الموردين" Icon={FaTruck} />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 items-center">
        {/* Search Input */}
        <SearchInput change={(v) => console.log(v)} label="مورد" />

        {/* Add Supplier Button */}
        <Link
          href="/dealzora/suppliers/add-supplier"
          className="flex gap-2 items-center justify-center px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 hover:scale-105 transition-all w-full shadow-sm hover:shadow-md"
        >
          <FaUserPlus />
          اضف مورد
        </Link>
      </div>
    </div>
  );
}
