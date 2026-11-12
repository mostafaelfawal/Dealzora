import { useState } from "react";

import { DEFAULT_REORDER_SETTINGS } from "../config/purchaseOrderOptions";
import type { ReorderSettings } from "../types/purchaseOrder";

const STORAGE_KEY = "dealzora:reorder-settings:v1";

function load(): ReorderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw)
      return {
        ...DEFAULT_REORDER_SETTINGS,
        ...(JSON.parse(raw) as Partial<ReorderSettings>),
      };
  } catch {
    // التخزين غير متاح أو تالف: القيم الافتراضية.
  }
  return DEFAULT_REORDER_SETTINGS;
}

/** إعدادات حساب النواقص (فترة البيع، التغطية، التوريد). تُحفظ على هذا الجهاز. */
export function useReorderSettings() {
  const [settings, setSettings] = useState<ReorderSettings>(load);

  function update(patch: Partial<ReorderSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // تجاهل.
      }
      return next;
    });
  }

  return { settings, update };
}
