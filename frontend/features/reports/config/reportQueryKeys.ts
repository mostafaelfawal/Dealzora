import type { DateRange } from "@/lib/dates";

import type { ProductRank } from "../types/report";

/** الجذر "reports" تُبطله شاشات البيع والشراء والمخزون بعد أي حركة. */
export const reportKeys = {
  all: ["reports"] as const,
  sales: (range: DateRange) => [...reportKeys.all, "sales", range] as const,
  products: (range: DateRange, rank: ProductRank) =>
    [...reportKeys.all, "products", range, rank] as const,
  debts: () => [...reportKeys.all, "debts"] as const,
  treasury: (range: DateRange) =>
    [...reportKeys.all, "treasury", range] as const,
};
