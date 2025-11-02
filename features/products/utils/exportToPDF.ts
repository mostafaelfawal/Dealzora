import toast from "react-hot-toast";
import { ProductType } from "../types/ProductType";

export const exportToPDF = async (products: ProductType[]) => {
  if (!products || products.length === 0) {
    toast.error("لا يوجد منتجات لتصديرها!");
    return;
  }

  //  تحميل pdfmake بشكل ديناميكي
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
