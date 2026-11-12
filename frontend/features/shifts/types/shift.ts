export interface Shift {
  id: string;
  cashierId: string;
  cashierName: string | null;
  /** الجهاز الذي فُتحت عليه (لكل جهاز كاشير درجه). */
  deviceName: string | null;
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
  /** الدفع الإلكتروني (للمدير فقط): يُطابق مع المحفظة لا مع الدرج. */
  walletSales: number | null;
  /** تفصيله حسب الطريقة (فودافون كاش، مدى، STC Pay...). */
  electronic: { key: string; label: string; value: number }[] | null;
  walletRefunds: number | null;
  expectedCash: number | null;
  countedCash: number | null;
  /** موجب = زيادة، سالب = عجز. */
  difference: number | null;
  note: string;
  version: number;
}
