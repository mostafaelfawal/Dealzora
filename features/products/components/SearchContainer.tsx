"use client";
import { FaPlus, FaSearch, FaFileExcel, FaFilePdf } from "react-icons/fa";
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
import * as XLSX from "xlsx";

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

  // 📘 استخراج إلى Excel
  const exportToExcel = () => {
    if (!products || products.length === 0) {
      toast.error("لا يوجد منتجات لتصديرها!");
      return;
    }

    const data = products.map((p: any) => ({
      الكود: p.code,
      الاسم: p.name,
      الفئة: p.categories,
      السعر: p.price,
      المخزون: p.stock ?? "—",
      "تنبيه المخزون": p.stockAlert ?? "—",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المنتجات");

    XLSX.writeFile(wb, "المنتجات.xlsx");
    toast.success("تم استخراج ملف Excel بنجاح!");
  };

  // 📕 استخراج إلى PDF
  const exportToPDF = async () => {
    if (!products || products.length === 0) {
      toast.error("لا يوجد منتجات لتصديرها!");
      return;
    }

    // ✅ تحميل pdfmake بشكل ديناميكي
    const pdfMake = (await import("pdfmake/build/pdfmake.js")).default;
    const pdfFonts = await import("pdfmake/build/vfs_fonts.js");
    pdfMake.vfs = pdfFonts.vfs;

    const tableBody = [
      [
        { text: "الكود", bold: true },
        { text: "الاسم", bold: true },
        { text: "الفئة", bold: true },
        { text: "السعر", bold: true },
        { text: "المخزون", bold: true },
        { text: "تنبيه المخزون", bold: true },
      ],
      ...products.map((p: any) => [
        p.code,
        p.name,
        p.categories,
        p.price.toString(),
        p.stock?.toString() ?? "—",
        p.stockAlert?.toString() ?? "—",
      ]),
    ];

    const docDefinition: any = {
      pageOrientation: "landscape",
      content: [
        { text: "قائمة المنتجات", style: "header", alignment: "center" },
        {
          table: {
            headerRows: 1,
            widths: ["auto", "*", "*", "auto", "auto", "auto"],
            body: tableBody,
          },
        },
      ],
      defaultStyle: {
        font: "Roboto",
        alignment: "right",
      },
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 10],
        },
      },
    };

    pdfMake.createPdf(docDefinition).download("المنتجات.pdf");
    toast.success("تم استخراج ملف PDF بنجاح!");
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6 items-center bg-white rounded-lg shadow-sm p-6 mb-6">
      {/* Search Input */}
      <div className="relative w-full group col-span-2">
        <input
          onChange={(e) => dispatch(setSearchQuery(e.target.value))}
          placeholder="ابحث عن منتج..."
          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 pl-10 text-gray-700 shadow-sm 
          focus:ring-2 focus:border-none focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 
          hover:shadow-md placeholder:text-gray-400"
        />
        <FaSearch className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-200" />
      </div>

      {/* categories Filter */}
      <select
        value={categoryValue}
        onChange={(e) => dispatch(setcategoriesQuery(e.target.value))}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-gray-700 shadow-sm 
          focus:ring-2 focus:border-none focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 
          hover:shadow-md cursor-pointer"
      >
        <option value="">جميع الفئات</option>
        {categories.map((c: string, i: number) => (
          <option key={i} value={c}>
            {c}
          </option>
        ))}
      </select>

      {/* Status Filter */}
      <select
        value={stateValue}
        onChange={(e) => dispatch(setStateQuery(e.target.value))}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-gray-700 shadow-sm 
          focus:ring-2 focus:border-none focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 
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

      {/* Add Product Button */}
      <button
        onClick={() => setModalIsOpen(true)}
        className="flex gap-2 items-center justify-center px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 hover:scale-105 transition-all w-full shadow-sm hover:shadow-md"
      >
        <FaPlus />
        اضف منتج
      </button>

      {/* Export Buttons */}
      <button
        onClick={exportToExcel}
        className="flex gap-2 items-center justify-center px-4 py-2 text-white bg-green-500 rounded-lg hover:bg-green-600 hover:scale-105 transition-all w-full shadow-sm hover:shadow-md"
      >
        <FaFileExcel />
        استخراج Excel
      </button>

      <button
        onClick={exportToPDF}
        className="flex gap-2 items-center justify-center px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 hover:scale-105 transition-all w-full shadow-sm hover:shadow-md"
      >
        <FaFilePdf />
        استخراج PDF
      </button>

      {modalIsOpen && (
        <AddProductModal closeModal={() => setModalIsOpen(false)} />
      )}
    </div>
  );
}
