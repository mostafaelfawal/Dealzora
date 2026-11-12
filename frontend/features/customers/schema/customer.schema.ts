import { z } from "zod";

import { normalizeDigits } from "@/lib/format";

import {
  ADDRESS_MAX,
  AMOUNT_MAX,
  NAME_MAX,
  NAME_MIN,
  NOTES_MAX,
  PHONE_MAX_DIGITS,
  PHONE_MIN_DIGITS,
} from "../config/customerLimits";
import { cleanName, cleanPhone } from "../lib/customerCalc";

const check = (fn: (text: string) => string | null) =>
  z.string().superRefine((text, ctx) => {
    const message = fn(text);
    if (message) ctx.addIssue({ code: "custom", message });
  });

const length = (text: string) => [...text].length;

function nameError(text: string) {
  const n = length(cleanName(text));
  if (n === 0) return "اكتب اسم العميل";
  if (n < NAME_MIN) return `الاسم ${NAME_MIN} أحرف على الأقل`;
  if (n > NAME_MAX) return `الاسم أطول من ${NAME_MAX} حرفاً`;
  return null;
}

function phoneError(text: string) {
  if (!text.trim()) return null; // اختياري
  const p = cleanPhone(text);
  if (!new RegExp(`^\\+?\\d{${PHONE_MIN_DIGITS},${PHONE_MAX_DIGITS}}$`).test(p))
    return "رقم الهاتف غير صالح. أرقام فقط (مثال: 01012345678).";
  return null;
}

const amountError = (label: string) => (text: string) => {
  if (!text.trim()) return null; // الفاضي = 0
  const n = Number(normalizeDigits(text).replace(/[,\s]/g, ""));
  if (!Number.isFinite(n)) return `${label} غير صالح`;
  if (n < 0) return `${label} لا يمكن أن يكون سالباً`;
  if (n > AMOUNT_MAX) return `${label} كبير جداً`;
  return null;
};

export const customerSchema = z.object({
  name: check(nameError),
  phone: check(phoneError),
  address: z.string().max(ADDRESS_MAX, `العنوان أطول من ${ADDRESS_MAX} حرفاً`),
  notes: z.string().max(NOTES_MAX, `الملاحظات أطول من ${NOTES_MAX} حرفاً`),
  creditLimit: check(amountError("الحد الائتماني")),
  openingBalance: check(amountError("الرصيد الافتتاحي")),
  isActive: z.boolean(),
  isWholesale: z.boolean(),
});

export type CustomerSchemaType = z.infer<typeof customerSchema>;
