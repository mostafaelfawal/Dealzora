import { toIsoDay } from "@/lib/dates";

import type { Frequency } from "../types/installment";

/**
 * معاينة الخطة في النموذج قبل الحفظ. نفس حساب backend/app/modules/installments/helper.py
 * (بالقروش ثم جنيه) حتى يرى التاجر الرقم نفسه الذي سيُحفظ.
 */

const cents = (pounds: number) => Math.round(pounds * 100);

export interface PlanPreview {
  financed: number;
  total: number;
  installment: number;
  lastInstallment: number;
  endDate: string | null;
}

export function previewPlan(v: {
  principal: number;
  downPayment: number;
  count: number;
  frequency: Frequency;
  startDate: string;
}): PlanPreview {
  const financed = Math.max(cents(v.principal) - cents(v.downPayment), 0);
  const total = financed; // لا زيادة على الأقساط (لا ربا)
  const count = Math.max(Math.floor(v.count), 1);
  const base = Math.floor(total / count);
  const last = total - base * (count - 1);
  return {
    financed: financed / 100,
    total: total / 100,
    installment: base / 100,
    lastInstallment: last / 100,
    endDate: v.startDate ? dueDate(v.startDate, v.frequency, count - 1) : null,
  };
}

/** موعد القسط رقم index (من صفر)، والشهري يُقصّ لآخر الشهر. */
export function dueDate(
  startIso: string,
  frequency: Frequency,
  index: number,
): string {
  const [y, m, d] = startIso.split("-").map(Number);
  if (frequency === "monthly") {
    const monthIndex = m - 1 + index;
    const year = y + Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    const lastDay = new Date(year, month + 1, 0).getDate();
    return toIsoDay(new Date(year, month, Math.min(d, lastDay)));
  }
  const step = frequency === "biweekly" ? 14 : 7;
  return toIsoDay(new Date(y, m - 1, d + step * index));
}

/** نفس الشهر القادم من اليوم: الافتراضي لموعد أول قسط. */
export function nextMonthIso(now = new Date()): string {
  return dueDate(toIsoDay(now), "monthly", 1);
}
