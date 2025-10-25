"use client";

import { useState } from "react";
import { ProductType } from "../../types/ProductType";
import ProductRow from "./ProductRow";
import ProductPagination from "./ProductPagination";

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
  const productsPerPage = 5;

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
          {currentProducts.map((product) => (
            <ProductRow
              key={product.code}
              product={product}
              openRow={openRow}
              setOpenRow={setOpenRow}
            />
          ))}
        </tbody>

        <tfoot>
          <ProductPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalProducts={products.length}
            indexOfFirst={indexOfFirst}
            indexOfLast={indexOfLast}
            handlePageChange={setCurrentPage}
          />
        </tfoot>
      </table>
    </div>
  );
}
