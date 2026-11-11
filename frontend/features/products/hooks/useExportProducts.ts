import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";
import { toastFileSaved } from "@/lib/fileToast";

import type { GetProductsParams } from "../api/products.api";
import { exportProducts } from "../lib/productExcel";

/** نفس الـ id: رسالة التقدم تتحول لرسالة النجاح/الفشل بدل تراكم رسائل. */
const TOAST_ID = "export-products";

export default function useExportProducts() {
  return useMutation({
    mutationFn: (params: GetProductsParams) => {
      toast.loading("جارٍ تجهيز ملف Excel…", { id: TOAST_ID });
      return exportProducts(params, (loaded, total) =>
        toast.loading(`جارٍ تجهيز ملف Excel… (${loaded} من ${total} صنف)`, {
          id: TOAST_ID,
        }),
      );
    },
    onSuccess: ({ count, file }) => {
      if (!file) {
        toast.info("لا توجد أصناف للتصدير", {
          id: TOAST_ID,
          description: "غيّر الفلاتر أو أضف أصنافاً أولاً.",
        });
        return;
      }
      toastFileSaved({
        id: TOAST_ID,
        title: "تم تصدير المنتجات إلى Excel بنجاح",
        detail: `${count} صنف`,
        file,
      });
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, "تعذّر تصدير المنتجات إلى Excel"), {
        id: TOAST_ID,
      }),
  });
}
