"use client";
import { FaPlus, FaFileExcel, FaFilePdf, FaShoppingBag } from "react-icons/fa";
import { useEffect, useState } from "react";
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
import Tooltip from "@/components/Tooltip";

import { MenuItem, Select, FormControl, InputLabel } from "@mui/material";
import Link from "next/link";
import SearchInput from "@/components/SearchInput";

export default function SearchContainer() {
  const { categories, error } = useFetchCategories();
  const products = useSelector((state: RootState) => state.products.products);
  const dispatch = useDispatch<AppDispatch>();
  const { categoriesQuery, stateQuery, searchQuery } = useSelector(
    (state: RootState) => state.search
  );
  useEffect(() => {
    if (error) {
      toast.dismiss();
      toast.error(error);
    }
  }, [error]);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <HeaderPage title="ادارة المنتجات" Icon={FaShoppingBag} />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 items-center">
        {/* Search Input - MUI TextField */}
        <div className="relative w-full sm:col-span-2 md:col-span-2 lg:col-span-2">
          <SearchInput
            change={(v) => dispatch(setSearchQuery(v))}
            label="منتج"
            value={searchQuery}
          />
        </div>

        {/* Categories Filter - MUI Select */}
        <div className="w-full">
          <FormControl fullWidth size="small">
            <InputLabel
              sx={{
                backgroundColor: "white",
                px: 0.5,
                "&.Mui-focused": {
                  color: "#3b82f6",
                },
              }}
            >
              الفئة
            </InputLabel>
            <Select
              value={categoriesQuery}
              label="الفئة"
              onChange={(e) => dispatch(setcategoriesQuery(e.target.value))}
              sx={{
                borderRadius: "16px",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#e5e7eb",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#d1d5db",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#3b82f6",
                },
              }}
            >
              <MenuItem value="">جميع الفئات</MenuItem>
              {categories.map((c: string, i: number) => (
                <MenuItem key={i} value={c}>
                  {c}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>

        {/* Status Filter - MUI Select */}
        <div className="w-full">
          <FormControl fullWidth size="small">
            <InputLabel
              sx={{
                backgroundColor: "white",
                px: 0.5,
                "&.Mui-focused": {
                  color: "#3b82f6",
                },
              }}
            >
              الحالة
            </InputLabel>
            <Select
              value={stateQuery}
              label="الحالة"
              onChange={(e) => dispatch(setStateQuery(e.target.value))}
              sx={{
                borderRadius: "16px",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#e5e7eb",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#d1d5db",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#3b82f6",
                },
              }}
            >
              <MenuItem value="all">جميع الحالات</MenuItem>
              <MenuItem value="in">
                <span className="text-green-600 font-semibold">🟢 موجود</span>
              </MenuItem>
              <MenuItem value="low">
                <span className="text-yellow-600 font-semibold">🟡 قليل</span>
              </MenuItem>
              <MenuItem value="out">
                <span className="text-red-600 font-semibold">🔴 منتهي</span>
              </MenuItem>
            </Select>
          </FormControl>
        </div>

        {/* Add Product Button - باقي كما هو */}
        <Link
          href="products/add-product"
          className="flex gap-2 items-center justify-center px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 hover:scale-105 transition-all w-full shadow-sm hover:shadow-md"
        >
          <FaPlus />
          اضف منتج
        </Link>

        {/* Export Buttons - باقي كما هو */}
        <div className="flex gap-2 col-span-2 md:col-span-2 lg:col-span-2">
          <Tooltip side="bottom" message="تصدير المنتجات الى ملف Excel">
            <button
              onClick={() => exportToExcel(products)}
              className="flex-1 flex gap-2 items-center justify-center px-4 py-2 text-white bg-green-500 rounded-lg hover:bg-green-600 hover:scale-105 transition-all shadow-sm hover:shadow-md"
            >
              <FaFileExcel />
              Excel
            </button>
          </Tooltip>
          <Tooltip side="bottom" message="تصدير المنتجات الى ملف PDF">
            <button
              onClick={() => exportToPDF(products)}
              className="flex-1 flex gap-2 items-center justify-center px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 hover:scale-105 transition-all shadow-sm hover:shadow-md"
            >
              <FaFilePdf />
              PDF
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
