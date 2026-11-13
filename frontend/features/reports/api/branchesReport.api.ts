import { toPounds } from "@/lib/apiMap";
import { api } from "@/lib/axios";
import { parseIsoDay } from "@/lib/dates";

/** أرقام فرع (أو المحل كله) في الفترة. المال بالجنيه بعد التحويل من القروش. */
export interface BranchTotals {
  count: number;
  revenue: number;
  returns: number;
  net: number;
  cost: number;
  profit: number;
  discounts: number;
  cash: number;
  credit: number;
  wallet: number;
  expenses: number;
  netProfit: number;
}

export interface BranchReportRow extends BranchTotals {
  id: string;
  name: string;
  code: string;
  isMe: boolean;
  isActive: boolean;
  online: boolean;
  /** آخر رفع لملخص هذا الفرع (ISO) أو null. */
  lastUpdate: string | null;
}

export interface CombinedDay {
  day: number;
  count: number;
  net: number;
  profit: number;
  expenses: number;
}

export interface CombinedReport {
  totals: BranchTotals;
  branches: BranchReportRow[];
  days: CombinedDay[];
}

/* eslint-disable @typescript-eslint/no-explicit-any -- شكل الرد مكتوب في الـ backend */
const toTotals = (d: any): BranchTotals => ({
  count: d.count ?? 0,
  revenue: toPounds(d.revenue ?? 0),
  returns: toPounds(d.returns ?? 0),
  net: toPounds(d.net ?? 0),
  cost: toPounds(d.cost ?? 0),
  profit: toPounds(d.profit ?? 0),
  discounts: toPounds(d.discounts ?? 0),
  cash: toPounds(d.cash ?? 0),
  credit: toPounds(d.credit ?? 0),
  wallet: toPounds(d.wallet ?? 0),
  expenses: toPounds(d.expenses ?? 0),
  netProfit: toPounds(d.net_profit ?? (d.profit ?? 0) - (d.expenses ?? 0)),
});

export async function fetchCombinedReport(r: {
  from: string;
  to: string;
}): Promise<CombinedReport> {
  const { data } = await api.get("/branch-sync/report", {
    params: { date_from: r.from, date_to: r.to },
  });
  return {
    totals: toTotals(data.totals),
    branches: (data.branches ?? []).map((b: any) => ({
      ...toTotals(b),
      id: b.id,
      name: b.name,
      code: b.code,
      isMe: Boolean(b.is_me),
      isActive: b.is_active !== false,
      online: Boolean(b.online),
      lastUpdate: b.last_update ?? null,
    })),
    days: (data.days ?? []).map((d: any) => ({
      day: parseIsoDay(d.day),
      count: d.count ?? 0,
      net: toPounds(d.net ?? 0),
      profit: toPounds(d.profit ?? 0),
      expenses: toPounds(d.expenses ?? 0),
    })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
