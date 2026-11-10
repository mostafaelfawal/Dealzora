export interface Shift {
  id: string;
  cashierId: string;
  cashierName: string | null;
  isOpen: boolean;
  openedAt: number;
  closedAt: number | null;
  /** فكّة بداية الوردية (جنيه). */
  openingFloat: number;
  salesCount: number;
  returnsCount: number;
  /** القيم التالية null للكاشير (يعدّ الدرج "أعمى"). */
  salesTotal: number | null;
  cashSales: number | null;
  creditSales: number | null;
  cashRefunds: number | null;
  expectedCash: number | null;
  countedCash: number | null;
  /** موجب = زيادة، سالب = عجز. */
  difference: number | null;
  note: string;
  version: number;
}
