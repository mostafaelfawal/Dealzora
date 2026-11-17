import type { StatementEntryType } from "../types/customer";

/** اسم نوع الحركة في كشف الحساب (الشاشة وملف الـ PDF). */
export const STATEMENT_TYPE_LABEL: Record<StatementEntryType, string> = {
  sale: "فاتورة بيع",
  payment: "دفعة",
  return: "مرتجع",
  opening: "رصيد افتتاحي",
  adjustment: "تعديل يدوي",
  deposit: "باقٍ حُفظ رصيداً",
  balance_use: "دفع من رصيده",
  balance_payout: "صرف رصيد نقداً",
};
