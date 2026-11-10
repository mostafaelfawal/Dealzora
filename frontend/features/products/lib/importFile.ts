import { toast } from "sonner";

import { SHEET_PATTERN } from "../config/importOptions";
import { readSheet, type ParsedSheet } from "./excelSheet";

export interface LoadedSheet {
  fileName: string;
  sheet: ParsedSheet;
}

/**
 * يتحقق من الامتداد ثم يقرأ الملف. أي مشكلة تظهر كرسالة واضحة ويرجّع null.
 * مشترك بين نافذة الاستيراد والإفلات المباشر على صفحة المنتجات.
 */
export async function loadImportFile(file: File): Promise<LoadedSheet | null> {
  if (!SHEET_PATTERN.test(file.name)) {
    toast.error("الملف غير مدعوم", {
      description: "اختر ملف Excel بصيغة xlsx أو xls أو csv.",
    });
    return null;
  }
  try {
    const sheet = await readSheet(file);
    if (sheet.columns.length === 0 || sheet.rows.length === 0) {
      toast.error("الملف فارغ", {
        description: "لم نجد أي صفوف بيانات تحت الصف الأول.",
      });
      return null;
    }
    return { fileName: file.name, sheet };
  } catch {
    toast.error("تعذّرت قراءة الملف", {
      description: "تأكد أن الملف سليم وغير محمي بكلمة مرور.",
    });
    return null;
  }
}
