import * as XLSX from "xlsx";
import { ProductType } from "../types/ProductType";
import toast from "react-hot-toast";

export const exportToExcel = (products: ProductType[]) => {
  if (!products || products.length === 0) {
    toast.error("لا يوجد منتجات لتصديرها!");
    return;
  }
  const data = products.map((p: any) => {
    const state =
      p.stock === 0 ? "منتهي" : p.stock <= p.stockAlert ? "قليل" : "متوفر";
    return {
      الكود: p.code,
      الاسم: p.name,
      الفئة: p.categories,
      السعر: p.price,
      المخزون: p.stock ?? "—",
      الحالة: state,
    };
  });

  const ws = XLSX.utils.json_to_sheet(data, { cellStyles: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المنتجات");

  XLSX.writeFile(wb, "المنتجات.xlsx");
  toast.success("تم استخراج ملف Excel بنجاح!");
};
