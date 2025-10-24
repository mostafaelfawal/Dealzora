"use client";

import Image from "next/image";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaArrowLeft, FaArrowRight, FaEdit, FaTrash } from "react-icons/fa";
import { ProductType } from "../types/ProductType";
import Tooltip from "@/components/Tooltip";
import { RxDotsVertical } from "react-icons/rx";

export default function ProductTable() {
  const [products] = useState<ProductType[]>([
    {
      image: "/productImages/Antipasto Salad.jpeg",
      name: "Antipasto Salad",
      code: "SKU-234135",
      price: 200,
      category: "أطعمة",
      stock: 20,
      status: "موجود",
    },
    {
      image: "/productImages/Lenovo ThinkPad X1.webp",
      name: "Lenovo ThinkPad X1",
      code: "SKU-981245",
      price: 24500,
      category: "إلكترونيات",
      stock: 8,
      status: "قليل",
    },
    {
      image: "/productImages/Cotton T-Shirt.webp",
      name: "Cotton T-Shirt",
      code: "SKU-712534",
      price: 350,
      category: "ملابس",
      stock: 0,
      status: "منتهي",
    },
    {
      image: "/productImages/Philips Coffee Maker.webp",
      name: "Philips Coffee Maker",
      code: "SKU-551231",
      price: 1800,
      category: "أدوات منزلية",
      stock: 14,
      status: "موجود",
    },
    {
      image: "/productImages/Sony WH-1000XM5.webp",
      name: "Sony WH-1000XM5",
      code: "SKU-998812",
      price: 12000,
      category: "إلكترونيات",
      stock: 5,
      status: "قليل",
    },
    {
      image: "/productImages/Nike Air Zoom.webp",
      name: "Nike Air Zoom",
      code: "SKU-331289",
      price: 2500,
      category: "ملابس",
      stock: 30,
      status: "موجود",
    },
    {
      image: "/productImages/Apple Watch Series 9.png",
      name: "Apple Watch Series 9",
      code: "SKU-456712",
      price: 18500,
      category: "إلكترونيات",
      stock: 0,
      status: "منتهي",
    },
    {
      image: "/productImages/Natural Mango Juice.jpg",
      name: "Natural Mango Juice",
      code: "SKU-771245",
      price: 25,
      category: "مشروبات",
      stock: 50,
      status: "موجود",
    },
  ]);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const productsPerPage: number = 5;
  const totalPages: number = Math.ceil(products.length / productsPerPage);

  const indexOfLast = currentPage * productsPerPage;
  const indexOfFirst = indexOfLast - productsPerPage;
  const currentProducts = products.slice(indexOfFirst, indexOfLast);

  const statusColors = {
    موجود: "bg-green-100 text-green-700",
    منتهي: "bg-red-100 text-red-700",
    قليل: "bg-yellow-100 text-yellow-700",
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow-md p-4">
      <table className="w-full text-right">
        <thead className="bg-blue-500 text-white text-sm uppercase">
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
          {currentProducts.map((p) => (
            <tr
              key={p.code}
              className="hover:bg-blue-50 transition-colors border-b border-gray-200"
            >
              <td className="flex gap-3 py-3 px-4 items-center relative">
                <button
                  onClick={() => setOpenRow(openRow === p.code ? null : p.code)}
                  className="block md:hidden text-gray-600 hover:text-blue-500 transition"
                >
                  <RxDotsVertical size={20} />
                </button>

                <div className="relative w-12 h-12 rounded-lg overflow-hidden">
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-gray-400">كود: {p.code}</p>
                </div>

                {/* القائمة المنسدلة */}
                <AnimatePresence>
                  {openRow === p.code && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-10 right-0 z-10 block md:hidden bg-white border border-gray-200 shadow-lg rounded-lg p-3 w-48"
                    >
                      <p className="text-sm mb-1">
                        <span className="font-semibold">السعر:</span> {p.price}{" "}
                        ج.م
                      </p>
                      <p className="text-sm mb-1">
                        <span className="font-semibold">الفئة:</span>{" "}
                        {p.category}
                      </p>
                      <p className="text-sm mb-1">
                        <span className="font-semibold">المخزون:</span>{" "}
                        {p.stock}
                      </p>
                      <p className="text-sm mb-2">
                        <span className="font-semibold">الحالة:</span>{" "}
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            statusColors[p.status]
                          }`}
                        >
                          {p.status}
                        </span>
                      </p>

                      <div className="flex gap-2 pt-2">
                        <button className="flex-1 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs flex items-center justify-center gap-1">
                          <FaEdit /> تعديل
                        </button>
                        <button className="flex-1 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs flex items-center justify-center gap-1">
                          <FaTrash /> حذف
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </td>

              <td className="hidden md:table-cell py-3 px-4">{p.price} ج.م</td>
              <td className="hidden md:table-cell py-3 px-4">{p.category}</td>
              <td className="hidden md:table-cell py-3 px-4">{p.stock}</td>
              <td className="hidden md:table-cell py-3 px-4">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    statusColors[p.status]
                  }`}
                >
                  {p.status}
                </span>
              </td>

              <td className="hidden md:table-cell py-3 px-4">
                <div className="flex gap-2 flex-wrap">
                  <button className="flex items-center justify-center gap-1 px-3 py-1 text-white bg-blue-500 rounded hover:bg-blue-600 transition-colors text-sm">
                    <FaEdit /> تعديل
                  </button>
                  <button className="flex items-center justify-center gap-1 px-3 py-1 text-white bg-red-500 rounded hover:bg-red-600 transition-colors text-sm">
                    <FaTrash /> حذف
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>

        {/* الفوتر */}
        <tfoot>
          <tr>
            <td
              colSpan={6}
              className="py-4 px-4 flex flex-col sm:flex-row justify-between items-center gap-2"
            >
              <p className="text-gray-500 text-sm">
                عرض من {indexOfFirst + 1} إلى{" "}
                {indexOfLast > products.length ? products.length : indexOfLast}{" "}
                من {products.length} منتج
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 text-gray-500 hover:text-blue-500 disabled:opacity-50 rounded transition-colors"
                >
                  <FaArrowRight />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (num) => (
                    <Tooltip
                      key={num}
                      side="bottom"
                      message={`اذهب للصفحه ${num}`}
                    >
                      <button
                        onClick={() => handlePageChange(num)}
                        className={`px-3 py-1 rounded transition-colors ${
                          currentPage === num
                            ? "bg-blue-500 text-white"
                            : "border border-gray-300 hover:bg-blue-50"
                        }`}
                      >
                        {num}
                      </button>
                    </Tooltip>
                  )
                )}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 text-gray-500 hover:text-blue-500 disabled:opacity-50 rounded transition-colors"
                >
                  <FaArrowLeft />
                </button>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
