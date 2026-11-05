import type { Expense, ExpenseInput } from "../types/expense";
import type { ExpenseSchemaType } from "../schema/expense.schema";
import {
  amountOrZero,
  parseAmount,
  todayYmd,
  toYmd,
} from "./expenseCalc";

export const emptyValues = (): ExpenseSchemaType => ({
  category: "",
  amount: "",
  spentAt: todayYmd(),
  note: "",
});

export const expenseToForm = (e: Expense): ExpenseSchemaType => ({
  category: e.category,
  amount: String(e.amount),
  spentAt: toYmd(new Date(e.spentAt)),
  note: e.note,
});

export const formToInput = (v: ExpenseSchemaType): ExpenseInput => ({
  category: v.category,
  amount: amountOrZero(parseAmount(v.amount)),
  spentAt: v.spentAt,
  note: v.note.trim(),
});