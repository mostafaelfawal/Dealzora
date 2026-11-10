"use client";

import { useCurrency } from "@/lib/currency";

/** اختصار عملة المحل (ج.م، ر.س…) ويتحدّث فوراً لو غيّرها المدير. */
export function CurrencyLabel() {
  return <>{useCurrency().symbol}</>;
}
