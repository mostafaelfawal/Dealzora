import { toast } from "sonner";

import { revealFile, type SavedFile } from "./saveFile";

/**
 * رسالة نجاح موحّدة بعد حفظ ملف.
 * داخل Tauri تظهر فقط بعد أن يكتب Rust الملف فعلاً، ومعها زر يفتح مكانه.
 */
export function toastFileSaved({
  title,
  file,
  detail,
  id,
}: {
  title: string;
  file: SavedFile;
  /** سطر إضافي قبل اسم الملف (مثلاً "120 صنف"). */
  detail?: string;
  /** نفس id رسالة "جارٍ التجهيز…" لتتحول إليها بدل التراكم. */
  id?: string | number;
}) {
  const where = `«${file.fileName}» في مجلد التنزيلات (Downloads)`;
  const path = file.path;
  toast.success(title, {
    id,
    description: detail ? `${detail} · ${where}` : where,
    duration: 8000,
    action: path
      ? {
          label: "فتح المجلد",
          onClick: () =>
            void revealFile(path).catch(() =>
              toast.error("تعذّر فتح مجلد التنزيلات"),
            ),
        }
      : undefined,
  });
}
