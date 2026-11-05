import { z } from "zod";

import { AMOUNT_MAX, NOTE_MAX } from "../config/expenseLimits";
import { parseAmount } from "../lib/expenseCalc";

const check = (fn: (text: string) => string | null) =>
  z.string().superRefine((text, ctx) => {
    const message = fn(text);
    if (message) ctx.addIssue({ code: "custom", message });
  });

function amountError(text: string) {
  if (!text.trim()) return "اكتب المبلغ";
  const n = parseAmount(text);
  if (!Number.isFinite(n)) return "المبلغ غير صالح";
  if (n <= 0) return "اكتب مبلغاً أكبر من صفر";
  if (n > AMOUNT_MAX) return "المبلغ كبير جداً";
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6)
    return "المبلغ حتى خانتين عشريتين فقط";
  return null;
}

export const expenseSchema = z.object({
  category: check((t) => (t ? null : "اختر نوع المصروف")),
  amount: check(amountError),
  spentAt: check((t) =>
    /^\d{4}-\d{2}-\d{2}$/.test(t) ? null : "اختر تاريخ المصروف",
  ),
  note: z.string().max(NOTE_MAX, `الملاحظة أطول من ${NOTE_MAX} حرفاً`),
});

export type ExpenseSchemaType = z.infer<typeof expenseSchema>;