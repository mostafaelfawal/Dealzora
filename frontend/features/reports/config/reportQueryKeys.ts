import type { DateRange } from "@/lib/dates";

import type { ProductRank } from "../types/report";

/** الجذر "reports" تُبطله شاشات البيع والشراء والمخزون بعد أي حركة. */
export const reportKeys = {
  all: ["reports"] as const,
  sales: (range: DateRange) => [...reportKeys.all, "sales", range] as const,
  products: (range: DateRange, rank: ProductRank, categoryId: string | null) =>
    [...reportKeys.all, "products", range, rank, categoryId] as const,
  debts: () => [...reportKeys.all, "debts"] as const,
  treasury: (range: DateRange) =>
    [...reportKeys.all, "treasury", range] as const,
  purchases: (range: DateRange) =>
    [...reportKeys.all, "purchases", range] as const,
  promotions: (range: DateRange) =>
    [...reportKeys.all, "promotions", range] as const,
  returns: (range: DateRange) => [...reportKeys.all, "returns", range] as const,
  customers: (range: DateRange) =>
    [...reportKeys.all, "customers", range] as const,
  cashiers: (range: DateRange) =>
    [...reportKeys.all, "cashiers", range] as const,
};
