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
import Tooltip from "@/components/Tooltip";

// استيراد مكونات MUI للعناصر المطلوبة فقط
import {
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
} from "@mui/material";
import Link from "next/link";

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
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <HeaderPage title="ادارة المنتجات" Icon={FaShoppingBag} />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 items-center">
        {/* Search Input - MUI TextField */}
        <div className="relative w-full sm:col-span-2 md:col-span-2 lg:col-span-2">
          <TextField
            fullWidth
            placeholder="ابحث عن منتج..."
            onChange={(e) => dispatch(setSearchQuery(e.target.value))}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <FaSearch className="search-icon" />
                </InputAdornment>
              ),
              sx: {
                borderRadius: "16px",
                backgroundColor: "white",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#e5e7eb",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#d1d5db",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#3b82f6",
                  borderWidth: "2px",
                },
                "&.Mui-focused .search-icon": {
                  color: "#3b82f6",
                },
                "& .search-icon": {
                  color: "#9ca3af",
                  transition: "color 0.2s ease",
                },
              },
            }}
            size="small"
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
              value={categoryValue}
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
              value={stateValue}
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
              <MenuItem value="">جميع الحالات</MenuItem>
              <MenuItem value="موجود">
                <span className="text-green-600 font-semibold">🟢 موجود</span>
              </MenuItem>
              <MenuItem value="قليل">
                <span className="text-yellow-600 font-semibold">🟡 قليل</span>
              </MenuItem>
              <MenuItem value="منتهي">
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

        {modalIsOpen && (
          <AddProductModal closeModal={() => setModalIsOpen(false)} />
        )}
      </div>
    </div>
  );
}
