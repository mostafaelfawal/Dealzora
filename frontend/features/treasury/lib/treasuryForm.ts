import type { CashDirection, TreasuryInput } from "../types/treasury";
import type { TreasurySchemaType } from "../schema/treasury.schema";
import { amountOrZero, parseAmount, todayIso } from "./treasuryCalc";

/** دالة وليست ثابتاً: التاريخ الافتراضي لازم يكون يوم فتح النافذة. */
export const emptyTreasuryForm = (
  direction: CashDirection = "in",
): TreasurySchemaType => ({
  direction,
  amount: "",
  occurredOn: todayIso(),
  note: "",
});

export const formToInput = (v: TreasurySchemaType): TreasuryInput => ({
  direction: v.direction,
  amount: amountOrZero(parseAmount(v.amount)),
  occurredOn: v.occurredOn,
  note: v.note.trim(),
});
