"use client";

import { useCurrencySetting } from "@/features/settings/hooks/useSettings";
import { usePlan } from "@/lib/plan";

/** يحمّل عملة المحل وخطته من القاعدة عند فتح التطبيق (لا يرسم شيئاً).
 *  الخطة مطلوبة مبكراً لنص الإيصال وأزرار واتساب خارج الصفحات. */
export function CurrencySync() {
  useCurrencySetting();
  usePlan();
  return null;
}
