import { z } from "zod";

import { normalizeDigits } from "@/lib/format";

import { AMOUNT_MAX, NOTE_MAX } from "../config/treasuryLimits";

const check = (fn: (text: string) => string | null) =>
  z.string().superRefine((text, ctx) => {
    const message = fn(text);
    if (message) ctx.addIssue({ code: "custom", message });
  });

function amountError(text: string) {
  if (!text.trim()) return "اكتب المبلغ";
  const n = Number(normalizeDigits(text).replace(/[,\s]/g, ""));
  if (!Number.isFinite(n)) return "المبلغ غير صالح";
  if (n <= 0) return "اكتب مبلغاً أكبر من صفر";
  if (n > AMOUNT_MAX) return "المبلغ كبير جداً";
  return null;
}

function dateError(text: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "اختر تاريخاً صالحاً";
  return null;
}

function noteError(text: string) {
  const n = [...text.trim()].length;
  if (n === 0) return "اكتب سبب الحركة";
  if (n > NOTE_MAX) return `السبب أطول من ${NOTE_MAX} حرفاً`;
  return null;
}

export const treasurySchema = z.object({
  direction: z.enum(["in", "out"]),
  amount: check(amountError),
  occurredOn: check(dateError),
  note: check(noteError),
});

export type TreasurySchemaType = z.infer<typeof treasurySchema>;
