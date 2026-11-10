"use client";

import { useCurrencySetting } from "@/features/settings/hooks/useSettings";

/** يحمّل عملة المحل من القاعدة مرة عند فتح التطبيق (لا يرسم شيئاً). */
export function CurrencySync() {
  useCurrencySetting();
  return null;
}
