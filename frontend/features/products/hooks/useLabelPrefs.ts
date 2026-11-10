import { useCallback, useState } from "react";

import {
  DEFAULT_LABEL_PREFS,
  LABEL_SIZES,
  type LabelPrefs,
} from "../config/barcodeLabel";

const STORAGE_KEY = "dealzora:barcode-label:prefs";

function load(): LabelPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LABEL_PREFS;
    const saved = { ...DEFAULT_LABEL_PREFS, ...JSON.parse(raw) } as LabelPrefs;
    // مقاس محذوف من القائمة يرجع للافتراضي.
    if (!LABEL_SIZES.some((s) => s.value === saved.size)) {
      saved.size = DEFAULT_LABEL_PREFS.size;
    }
    return saved;
  } catch {
    return DEFAULT_LABEL_PREFS;
  }
}

/** إعدادات الملصق (المقاس وما يظهر عليه) تُحفظ على الجهاز، لأنها تتبع طابعته. */
export function useLabelPrefs() {
  const [prefs, setPrefs] = useState<LabelPrefs>(load);

  const patch = useCallback((next: Partial<LabelPrefs>) => {
    setPrefs((prev) => {
      const merged = { ...prev, ...next };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {}
      return merged;
    });
  }, []);

  return { prefs, patch };
}
