import type { Expense, ExpenseInput, ExpensesSummary } from "../types/expense";
import type {
  ExpenseCreatePayload,
  ExpenseDto,
  ExpensesSummaryDto,
  ExpenseUpdatePayload,
} from "../types/expenseApi";

/** قروش (backend) ⇄ جنيه (الواجهة). */
export const toPounds = (cents: number) => cents / 100;
export const toCents = (pounds: number) => Math.round(pounds * 100);

/** "2026-11-05" ← بداية اليوم بالتوقيت المحلي. */
const ymdToMs = (ymd: string) => Date.parse(`${ymd.slice(0, 10)}T00:00:00`);

export const toExpense = (dto: ExpenseDto): Expense => ({
  id: dto.id,
  category: dto.category,
  amount: toPounds(dto.amount),
  note: dto.note ?? "",
  spentAt: ymdToMs(dto.spent_at),
  createdByName: dto.created_by_name,
  version: dto.version,
});

export const toSummary = (dto: ExpensesSummaryDto): ExpensesSummary => ({
  today: toPounds(dto.today),
  week: toPounds(dto.week),
  month: toPounds(dto.month),
  total: toPounds(dto.total),
  count: dto.count,
});

export const toCreatePayload = (input: ExpenseInput): ExpenseCreatePayload => ({
  category: input.category,
  amount: toCents(input.amount),
  note: input.note.trim() || null,
  spent_at: input.spentAt,
});

export const toUpdatePayload = (
  input: ExpenseInput,
  baseVersion: number,
): ExpenseUpdatePayload => ({
  ...toCreatePayload(input),
  base_version: baseVersion,
});