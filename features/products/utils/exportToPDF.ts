import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";
import { ProductType } from "../types/ProductType";

export const exportToPDF = async (products: ProductType[]) => {
  if (!products || products.length === 0) {
    toast.error("لا يوجد منتجات لتصديرها!");
    return;
  }

  // إنشاء ملف PDF
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  // العنوان
  doc.setFontSize(18);
  doc.text("Product List", doc.internal.pageSize.getWidth() / 2, 40, {
    align: "center",
  });

  // إعداد رأس الجدول
  const headers = [
    ["Code", "Name", "Category", "Price", "Stock", "Stock Alert"],
  ];

  // البيانات من المنتجات
  const data = products.map((p) => [
    p.code,
    p.name,
    p.categories,
    p.price?.toString() ?? "—",
    p.stock?.toString() ?? "—",
    p.stockAlert?.toString() ?? "—",
  ]);

  // إنشاء الجدول باستخدام autoTable
  autoTable(doc, {
    head: headers,
    body: data,
    styles: {
      font: "helvetica",
      fontSize: 12,
      halign: "left",
      textColor: "black",
    },
    headStyles: {
      fillColor: [230, 230, 230],
      fontStyle: "bold",
    },
    startY: 60,
  });

  // حفظ الملف
  doc.save("products.pdf");
  toast.success("تم استخراج ملف PDF بنجاح!");
  toast.error(
    "الPDF لا يدعم العربية الأن (سيتم حل المشكله في الأصدار القادم ان شاء الله)"
  );
};
