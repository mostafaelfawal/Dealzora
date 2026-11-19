import { useState } from "react";
import { toast } from "sonner";

import { compressImage } from "../lib/imageResize";
import { useUploadStoreImage } from "./useOnlineStore";

export interface UploadedImage {
  id: string;
  /** رابط محلي للمعاينة الفورية قبل إعادة تحميل البيانات من السيرفر. */
  previewUrl: string;
}

/**
 * اختيار صورة من الجهاز ← ضغطها ← رفعها. يرجّع null لو أُلغي الاختيار أو فشل الرفع
 * (الخطأ يظهر للمستخدم هنا). square: قص مربع (الشعار).
 */
export function useImageUpload() {
  const upload = useUploadStoreImage();
  const [busy, setBusy] = useState(false);

  const pick = (opts: { square?: boolean } = {}) =>
    new Promise<UploadedImage | null>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        setBusy(true);
        try {
          const img = await compressImage(file, opts);
          const out = await upload.mutateAsync({
            contentType: img.contentType,
            base64: img.base64,
          });
          resolve({ id: out.id, previewUrl: img.previewUrl });
        } catch (e) {
          // أخطاء السيرفر يعرضها useUploadStoreImage، وهنا أخطاء الملف نفسه.
          if (e instanceof Error && !("isAxiosError" in e))
            toast.error(e.message);
          resolve(null);
        } finally {
          setBusy(false);
        }
      };
      input.click();
    });

  return { pick, busy };
}
