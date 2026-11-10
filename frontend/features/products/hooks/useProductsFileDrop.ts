import { useState } from "react";
import { toast } from "sonner";

import { useFileDrop } from "@/hooks/useFileDrop";

import { loadImportFile, type LoadedSheet } from "../lib/importFile";

const READ_TOAST = "products-drop-read";

/**
 * إفلات ملف Excel في أي مكان بصفحة المنتجات: يُقرأ الملف ثم تُفتح نافذة الاستيراد
 * مباشرة على خطوة ربط الأعمدة. يتوقف أثناء فتح نافذة (حتى لا يتعارض مع منطقة الإفلات بداخلها).
 */
export function useProductsFileDrop({
  enabled,
  onLoaded,
}: {
  enabled: boolean;
  onLoaded: (sheet: LoadedSheet) => void;
}) {
  const [reading, setReading] = useState(false);

  async function handleFiles(files: File[]) {
    if (reading) return;
    if (files.length > 1) {
      toast.info("سنستورد أول ملف فقط", {
        description: `«${files[0].name}»`,
      });
    }
    setReading(true);
    toast.loading("جارٍ قراءة الملف…", { id: READ_TOAST });
    try {
      const loaded = await loadImportFile(files[0]);
      if (loaded) onLoaded(loaded);
    } finally {
      toast.dismiss(READ_TOAST);
      setReading(false);
    }
  }

  const { dragging } = useFileDrop({
    enabled: enabled && !reading,
    onDrop: (files) => void handleFiles(files),
  });

  return { dragging };
}
