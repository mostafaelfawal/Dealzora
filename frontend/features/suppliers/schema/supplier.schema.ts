import { z } from "zod";

import { normalizeDigits } from "@/lib/format";

import {
  MAX_ADDRESS_LEN,
  MAX_MONEY,
  MAX_NAME_LEN,
  MAX_NOTES_LEN,
  PHONE_PATTERN,
} from "../config/supplierLimits";
import { parseNumber } from "../lib/supplierCalc";
import { MONEY_SCALE } from "../lib/supplierMapper";
import { currencyName } from "@/lib/currency";

const EPSILON = 1e-6;

const format = (value: number) => value.toLocaleString("en-US");
const isBlank = (text: string) => text.trim() === "";
const cleanText = (text: string) => text.split(/\s+/).filter(Boolean).join(" ");
const length = (text: string) => [...text].length;

function toScaled(text: string, scale: number): number | null {
  const value = parseNumber(text);
  if (!Number.isFinite(value)) return null;
  const scaled = value * scale;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > EPSILON) return null;
  return rounded;
}

const check = (fn: (text: string) => string | null) =>
  z.string().superRefine((text, ctx) => {
    const message = fn(text);
    if (message) ctx.addIssue({ code: "custom", message });
  });

function nameError(text: string) {
  const value = cleanText(text);
  if (!value) return "اسم المورد مطلوب";
  if (length(value) > MAX_NAME_LEN)
    return `اسم المورد أطول من ${MAX_NAME_LEN} حرفاً`;
  return null;
}

function phoneError(text: string) {
  if (isBlank(text)) return null;
  const phone = normalizeDigits(text).replace(/[\s-]/g, "");
  if (!PHONE_PATTERN.test(phone))
    return "رقم الهاتف غير صالح (أرقام فقط، من 7 إلى 15 رقماً)";
  return null;
}

const maxLength = (max: number, label: string) => (text: string) =>
  length(text.trim()) > max ? `${label} أطول من ${max} حرفاً` : null;

function openingError(text: string) {
  if (isBlank(text)) return null;
  const scaled = toScaled(text, MONEY_SCALE);
  if (scaled === null || scaled < 0)
    return "الرصيد يجب أن يكون رقماً صحيحاً (حتى خانتين عشريتين).";
  if (scaled > MAX_MONEY)
    return `الرصيد لا يتجاوز ${format(MAX_MONEY / MONEY_SCALE)} ${currencyName()}.`;
  return null;
}

export const supplierSchema = z.object({
  name: check(nameError),
  phone: check(phoneError),
  address: check(maxLength(MAX_ADDRESS_LEN, "العنوان")),
  notes: check(maxLength(MAX_NOTES_LEN, "الملاحظات")),
  openingBalance: check(openingError),
  isActive: z.boolean(),
});

export type SupplierSchemaType = z.infer<typeof supplierSchema>;

/** تحقق نافذة تسجيل الدفعة. */
export function paymentAmountError(text: string): string | null {
  const scaled = toScaled(text, MONEY_SCALE);
  if (scaled === null || scaled <= 0) return "أدخل مبلغاً أكبر من صفر.";
  if (scaled > MAX_MONEY)
    return `المبلغ لا يتجاوز ${format(MAX_MONEY / MONEY_SCALE)} ${currencyName()}.`;
  return null;
}
