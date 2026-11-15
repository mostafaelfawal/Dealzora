import { normalizeDigits } from "@/lib/format";
import type { TaxType } from "@/lib/tax";

/** نص «نوع الضريبة» من Excel ← النوع. يقبل العربي والإنجليزي (وما يصدّره البرنامج نفسه). */
export function parseTaxType(text: string): TaxType | null {
  const value = normalizeDigits(text).trim().toLowerCase().replace(/ى/g, "ي");
  if (!value) return null;
  if (/معفي|exempt/.test(value)) return "exempt";
  if (/صفر|zero|^0$/.test(value)) return "zero";
  if (/خاضع|taxable|^نعم$|^yes$/.test(value)) return "taxable";
  return null;
}
